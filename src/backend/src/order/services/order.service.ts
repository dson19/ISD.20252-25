import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { NotificationEventBus } from '../../notification/events/notification-event-bus';
import { PAYMENT_SERVICE } from '../../payment/interfaces/payment-service.interface';
import type { IPaymentService } from '../../payment/interfaces/payment-service.interface';
import { Product } from '../../product/entities/product.entity';
import { CartItemDto } from '../dto/cart-item.dto';
import { DeliveryInfoDto } from '../dto/delivery-info.dto';
import { DeliveryInfo } from '../entities/delivery-info.entity';
import { Invoice } from '../entities/invoice.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { OrderRepository } from '../order.repository';
import { CartStockIssue, CartService } from './cart.service';
import { ShippingCalculatorService } from './shipping-calculator.service';

/** Hành động làm thay đổi trạng thái đơn — gom guard chuyển trạng thái về một bảng. */
type OrderAction = 'updateDelivery' | 'approve' | 'reject' | 'cancel';

const ALLOWED_TRANSITIONS: Record<OrderAction, string[]> = {
  updateDelivery: ['PENDING', 'PENDING_PROCESSING'],
  approve: ['PENDING', 'PENDING_PROCESSING'],
  reject: ['PENDING', 'PENDING_PROCESSING'],
  cancel: ['PENDING', 'PENDING_PROCESSING'],
};

const ACTION_VERB: Record<OrderAction, string> = {
  updateDelivery: 'update delivery info',
  approve: 'be approved',
  reject: 'be rejected',
  cancel: 'be cancelled',
};

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Communicates via validated DTOs, primitive order parameters, and repository states.
 *   - Procedural Cohesion: Sequences complex order validations, shipping calculations, and entity persistence steps inside placeOrder().
 * + Reason why:
 *   - Delegating shipping calculations and cart validations to dedicated services ensures the ordering service maintains a clean, single procedural focus.
 *
 * + SOLID Principles Review:
 *   - SRP Adherence: Chỉ còn lo vòng đời đơn (đặt/cập nhật/duyệt/từ chối/huỷ). Truy vấn danh sách
 *     tách sang OrderQueryService, xác nhận hoàn tiền VietQR tách sang OrderRefundService.
 *   - OCP Adherence: Guard chuyển trạng thái dùng ALLOWED_TRANSITIONS (assertCanTransition); trạng thái
 *     hoàn tiền dùng cờ refundAutomated (do cổng tự quyết) thay vì if theo tên PAYPAL/VIETQR.
 *   - DIP Adherence: Hoàn tiền qua abstraction IPaymentService (token PAYMENT_SERVICE), không phụ thuộc
 *     concrete PaymentService và không cần forwardRef ở constructor.
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly orderRepository: OrderRepository,
    private readonly cartService: CartService,
    private readonly shippingCalculatorService: ShippingCalculatorService,
    private readonly notificationEventBus: NotificationEventBus,
    @Inject(PAYMENT_SERVICE)
    private readonly paymentService: IPaymentService,
  ) { }

  private assertCanTransition(order: Order, action: OrderAction): void {
    if (!ALLOWED_TRANSITIONS[action].includes(order.status)) {
      throw new BadRequestException(
        `Order ${order.orderID} cannot ${ACTION_VERB[action]} from status ${order.status}`,
      );
    }
  }

  async placeOrder(cartItems: CartItemDto[], deliveryInfoDto: DeliveryInfoDto): Promise<Order> {
    const stockCheck = await this.cartService.checkCartStock(cartItems);
    if (!stockCheck.available) {
      throw new BadRequestException({
        message: 'Some products do not have enough stock',
        issues: stockCheck.issues,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const mergedItems = this.mergeDuplicateItems(cartItems);
      const products: Product[] = [];
      const stockIssues: CartStockIssue[] = [];

      for (const item of mergedItems) {
        const product = await manager.findOne(Product, {
          where: { productID: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product || product.status !== 'ACTIVE') {
          stockIssues.push({
            productId: item.productId,
            requestedQuantity: item.quantity,
            availableQuantity: 0,
            shortageQuantity: item.quantity,
            reason: 'PRODUCT_NOT_AVAILABLE',
          });
          continue;
        }

        if (product.quantityInStock < item.quantity) {
          stockIssues.push({
            productId: item.productId,
            requestedQuantity: item.quantity,
            availableQuantity: product.quantityInStock,
            shortageQuantity: item.quantity - product.quantityInStock,
            reason: 'INSUFFICIENT_STOCK',
          });
          continue;
        }

        product.quantityInStock -= item.quantity;
        products.push(product);
      }

      if (stockIssues.length > 0) {
        throw new BadRequestException({
          message: 'Some products do not have enough stock',
          issues: stockIssues,
        });
      }

      await manager.save(Product, products);

      const subtotal = this.roundMoney(
        mergedItems.reduce((sum, item) => {
          const product = products.find((candidate) => candidate.productID === item.productId);
          return sum + Number(product?.currentPrice ?? 0) * item.quantity;
        }, 0),
      );
      const totalWeight = mergedItems.reduce((sum, item) => {
        const product = products.find((candidate) => candidate.productID === item.productId);
        return sum + Number(product?.weight ?? 0) * item.quantity;
      }, 0);
      const tax = this.roundMoney(subtotal * 0.1);
      const shippingFee = this.shippingCalculatorService.calculateShippingFee(
        deliveryInfoDto.province,
        totalWeight,
        subtotal,
      );
      const totalPayment = this.roundMoney(subtotal + tax + shippingFee);

      const order = await this.orderRepository.save(
        manager.create(Order, {
          subTotal: subtotal,
          tax,
          shippingFee,
          totalPayment,
          status: 'PENDING',
          customerAccessToken: this.generateCustomerAccessToken(),
        }),
        manager,
      );

      const orderItems = mergedItems.map((item) => {
        const product = products.find((candidate) => candidate.productID === item.productId);
        return manager.create(OrderItem, {
          order,
          product,
          quantity: item.quantity,
          unitPrice: Number(product?.currentPrice ?? 0),
        });
      });
      await manager.save(OrderItem, orderItems);

      await manager.save(
        DeliveryInfo,
        manager.create(DeliveryInfo, {
          ...deliveryInfoDto,
          deliveryNotes: deliveryInfoDto.deliveryNotes,
          order,
        }),
      );

      await manager.save(
        Invoice,
        manager.create(Invoice, {
          totalExcludeVAT: subtotal,
          totalIncludeVAT: this.roundMoney(subtotal + tax),
          shippingFee,
          totalPayment,
          order,
        }),
      );

      return this.findOrderOrFail(order.orderID, manager);
    });
  }

  async calculateShippingFee(cartItems: CartItemDto[], province: string) {
    const mergedItems = this.mergeDuplicateItems(cartItems);
    const productIds = mergedItems.map((item) => item.productId);
    const products = await this.dataSource.manager.find(Product, {
      where: { productID: In(productIds) },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Some products are not available');
    }

    const subtotal = this.roundMoney(
      mergedItems.reduce((sum, item) => {
        const product = products.find((candidate) => candidate.productID === item.productId);
        return sum + Number(product?.currentPrice ?? 0) * item.quantity;
      }, 0),
    );
    const totalWeight = mergedItems.reduce((sum, item) => {
      const product = products.find((candidate) => candidate.productID === item.productId);
      return sum + Number(product?.weight ?? 0) * item.quantity;
    }, 0);
    const shippingFee = this.shippingCalculatorService.calculateShippingFee(
      province,
      totalWeight,
      subtotal,
    );
    const tax = this.roundMoney(subtotal * 0.1);

    return {
      subtotal,
      tax,
      shippingFee,
      totalPayment: this.roundMoney(subtotal + tax + shippingFee),
    };
  }

  async getOrderDetail(orderId: number): Promise<any> {
    const order = await this.findOrderOrFail(orderId);
    const paymentInfo = await this.orderRepository.getSuccessfulPaymentInfo(orderId, this.dataSource.manager);
    return {
      ...order,
      paymentMethod: paymentInfo?.method ?? null,
    };
  }

  async getCustomerOrderDetail(orderId: number, token: string): Promise<any> {
    await this.findCustomerOrderOrFail(orderId, token);
    return this.getOrderDetail(orderId);
  }

  async updateDeliveryInfo(orderId: number, deliveryInfoDto: DeliveryInfoDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.findOrderOrFail(orderId, manager);
      this.assertCanTransition(order, 'updateDelivery');

      const subtotal = this.roundMoney(Number(order.subTotal));
      const tax = this.roundMoney(Number(order.tax));
      const totalWeight = (order.orderItems ?? []).reduce((sum, item) => {
        return sum + Number(item.product?.weight ?? 0) * item.quantity;
      }, 0);
      const shippingFee = this.shippingCalculatorService.calculateShippingFee(
        deliveryInfoDto.province,
        totalWeight,
        subtotal,
      );
      const totalPayment = this.roundMoney(subtotal + tax + shippingFee);

      order.shippingFee = shippingFee;
      order.totalPayment = totalPayment;
      await this.orderRepository.save(order, manager);

      const deliveryInfo = order.deliveryInfo ?? manager.create(DeliveryInfo, { order });
      Object.assign(deliveryInfo, {
        ...deliveryInfoDto,
        deliveryNotes: deliveryInfoDto.deliveryNotes,
        order,
      });
      await manager.save(DeliveryInfo, deliveryInfo);

      const invoice = order.invoice ?? manager.create(Invoice, { order });
      Object.assign(invoice, {
        totalExcludeVAT: subtotal,
        totalIncludeVAT: this.roundMoney(subtotal + tax),
        shippingFee,
        totalPayment,
        order,
      });
      await manager.save(Invoice, invoice);

      return this.findOrderOrFail(orderId, manager);
    });
  }

  async approveOrder(orderId: number): Promise<Order> {
    const order = await this.findOrderOrFail(orderId);
    this.assertCanTransition(order, 'approve');

    order.status = 'APPROVED';
    await this.orderRepository.save(order);
    const updatedOrder = await this.findOrderOrFail(orderId);
    this.notificationEventBus.publish({
      type: 'ORDER_APPROVED',
      orderId,
    });
    return updatedOrder;
  }

  async rejectOrder(orderId: number): Promise<Order> {
    const existingOrder = await this.findOrderOrFail(orderId);
    const paymentInfo = await this.orderRepository.getSuccessfulPaymentInfo(orderId, this.dataSource.manager);

    let refundAutomated = false;
    if (existingOrder.status === 'PENDING_PROCESSING' && paymentInfo?.method) {
      ({ automated: refundAutomated } = await this.paymentService.processRefundIfSupported(
        orderId,
        Number(existingOrder.totalPayment),
        paymentInfo.method,
      ));
    }

    const updatedOrder = await this.dataSource.transaction(async (manager) => {
      const order = await this.findOrderOrFail(orderId, manager);
      this.assertCanTransition(order, 'reject');

      await this.restoreReservedStock(manager, order);

      order.status = refundAutomated || order.status !== 'PENDING_PROCESSING'
        ? 'REJECTED'
        : 'REFUND_PENDING';

      await this.orderRepository.save(order, manager);
      return this.findOrderOrFail(orderId, manager);
    });

    this.notificationEventBus.publish({
      type: 'ORDER_REJECTED',
      orderId,
      paymentTransactionId: paymentInfo?.transaction_id,
      refundMethod: paymentInfo?.method ?? null,
      refundStatus: this.resolveRefundStatus(paymentInfo?.method ?? null, refundAutomated, updatedOrder.status),
    });
    return updatedOrder;
  }

  async cancelOrder(orderId: number): Promise<Order> {
    const existingOrder = await this.findOrderOrFail(orderId);
    const paymentInfo = await this.orderRepository.getSuccessfulPaymentInfo(orderId, this.dataSource.manager);

    let refundAutomated = false;
    if (existingOrder.status === 'PENDING_PROCESSING' && paymentInfo?.method) {
      ({ automated: refundAutomated } = await this.paymentService.processRefundIfSupported(
        orderId,
        Number(existingOrder.totalPayment),
        paymentInfo.method,
      ));
    }

    const updatedOrder = await this.dataSource.transaction(async (manager) => {
      const order = await this.findOrderOrFail(orderId, manager);
      this.assertCanTransition(order, 'cancel');

      await this.restoreReservedStock(manager, order);

      order.status = refundAutomated || order.status !== 'PENDING_PROCESSING'
        ? 'CANCELLED'
        : 'REFUND_PENDING';

      await this.orderRepository.save(order, manager);
      return this.findOrderOrFail(orderId, manager);
    });

    this.notificationEventBus.publish({
      type: 'ORDER_CANCELLED',
      orderId,
      paymentTransactionId: paymentInfo?.transaction_id,
      refundMethod: paymentInfo?.method ?? null,
      refundStatus: this.resolveRefundStatus(paymentInfo?.method ?? null, refundAutomated, updatedOrder.status),
    });
    return updatedOrder;
  }

  async cancelCustomerOrder(orderId: number, token: string): Promise<Order> {
    await this.findCustomerOrderOrFail(orderId, token);
    return this.cancelOrder(orderId);
  }

  private async findCustomerOrderOrFail(orderId: number, token: string): Promise<Order> {
    if (!token?.trim()) {
      throw new BadRequestException('Missing customer order access token');
    }
    const order = await this.orderRepository.findByToken(orderId, token);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} was not found for this access token`);
    }
    return order;
  }

  /**
   * Trạng thái hoàn tiền suy từ KẾT QUẢ hoàn tiền (refundAutomated do cổng tự quyết qua
   * processRefundIfSupported), KHÔNG phân nhánh theo tên cổng → thêm cổng mới không phải sửa hàm này.
   *   - Không có giao dịch → không cần hoàn.
   *   - Cổng hoàn tự động → REFUNDED ngay.
   *   - Cổng không hoàn tự động (vd VietQR thủ công) → REFUND_PENDING cho tới khi xác nhận tay.
   */
  private resolveRefundStatus(paymentMethod: string | null, refundAutomated: boolean, orderStatus: string): string {
    if (!paymentMethod) {
      return 'No payment refund required';
    }
    if (refundAutomated) {
      return 'REFUNDED';
    }
    return orderStatus === 'REFUNDED' ? 'REFUNDED' : 'REFUND_PENDING';
  }

  private async restoreReservedStock(manager: EntityManager, order: Order): Promise<void> {
    for (const item of order.orderItems ?? []) {
      const productId = item.product?.productID;
      if (!productId) {
        continue;
      }

      const product = await manager.findOne(Product, {
        where: { productID: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (product) {
        product.quantityInStock += item.quantity;
        await manager.save(Product, product);
      }
    }
  }

  private async findOrderOrFail(orderId: number, manager?: EntityManager): Promise<Order> {
    const order = await this.orderRepository.findFullById(orderId, manager);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    return order;
  }

  private mergeDuplicateItems(cartItems: CartItemDto[]): CartItemDto[] {
    const itemMap = new Map<number, number>();

    for (const item of cartItems) {
      itemMap.set(item.productId, (itemMap.get(item.productId) ?? 0) + item.quantity);
    }

    return Array.from(itemMap.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private generateCustomerAccessToken(): string {
    return randomBytes(32).toString('hex');
  }
}
