import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { NotificationEventBus } from '../../notification/events/notification-event-bus';
import { PaymentService } from '../../payment/services/payment.service';
import { Product } from '../../product/entities/product.entity';
import { CartItemDto } from '../dto/cart-item.dto';
import { DeliveryInfoDto } from '../dto/delivery-info.dto';
import { DeliveryInfo } from '../entities/delivery-info.entity';
import { Invoice } from '../entities/invoice.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { CartStockIssue, CartService } from './cart.service';
import { ShippingCalculatorService } from './shipping-calculator.service';

export interface OrderListFilters {
  search?: string;
  dateRange?: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
  paymentMethod?: 'ALL' | 'PAYPAL' | 'VIETQR' | 'UNPAID';
}

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Communicates via validated DTOs, primitive order parameters, and repository states.
 *   - Procedural Cohesion: Sequences complex order validations, shipping calculations, and entity persistence steps inside placeOrder().
 * + Reason why:
 *   - Delegating shipping calculations and cart validations to dedicated services ensures the ordering service maintains a clean, single procedural focus.
 * 
 * + SOLID Principles Review:
 *   - SRP Violation: OrderService is responsible for order processing calculations, stock validation coordination, workflow state transitions, and third-party payment refunds.
 *     Improvement: Split into OrderCalculatorService, StockReservationService, and OrderWorkflowService.
 *   - OCP Violation: Conditional branches in rejectOrder() and cancelOrder() check specific payment methods (PAYPAL, VIETQR). Adding new payment systems requires modifying this service.
 *     Improvement: Implement a unified PaymentRefundStrategy interface.
 *   - DIP Violation: Depends directly on concrete PaypalService (using forwardRef to resolve circular dependency).
 *     Improvement: Introduce a RefundProcessor interface abstraction.
 */
@Injectable()
export class OrderService {
  private readonly defaultPendingPageSize = 30;

  constructor(
    private readonly dataSource: DataSource,
    private readonly cartService: CartService,
    private readonly shippingCalculatorService: ShippingCalculatorService,
    private readonly notificationEventBus: NotificationEventBus,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
  ) { }

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

      const order = await manager.save(
        Order,
        manager.create(Order, {
          subTotal: subtotal,
          tax,
          shippingFee,
          totalPayment,
          status: 'PENDING',
          customerAccessToken: this.generateCustomerAccessToken(),
        }),
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

      return this.findOrderOrFail(manager, order.orderID);
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
    const order = await this.findOrderOrFail(this.dataSource.manager, orderId);
    const paymentInfo = await this.getSuccessfulPaymentInfo(this.dataSource.manager, orderId);
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
      const order = await this.findOrderOrFail(manager, orderId);
      if (!['PENDING', 'PENDING_PROCESSING'].includes(order.status)) {
        throw new BadRequestException(`Order ${orderId} cannot update delivery info from status ${order.status}`);
      }

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
      await manager.save(Order, order);

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

      return this.findOrderOrFail(manager, orderId);
    });
  }

  async approveOrder(orderId: number): Promise<Order> {
    const order = await this.findOrderOrFail(this.dataSource.manager, orderId);
    if (!['PENDING', 'PENDING_PROCESSING'].includes(order.status)) {
      throw new BadRequestException(`Order ${orderId} cannot be approved from status ${order.status}`);
    }

    order.status = 'APPROVED';
    await this.dataSource.manager.save(Order, order);
    const updatedOrder = await this.findOrderOrFail(this.dataSource.manager, orderId);
    this.notificationEventBus.publish({
      type: 'ORDER_APPROVED',
      orderId,
    });
    return updatedOrder;
  }

  async rejectOrder(orderId: number): Promise<Order> {
    const existingOrder = await this.findOrderOrFail(this.dataSource.manager, orderId);
    const paymentInfo = await this.getSuccessfulPaymentInfo(this.dataSource.manager, orderId);

    let refundAutomated = false;
    if (existingOrder.status === 'PENDING_PROCESSING' && paymentInfo?.method) {
      ({ automated: refundAutomated } = await this.paymentService.processRefundIfSupported(
        orderId,
        Number(existingOrder.totalPayment),
        paymentInfo.method,
      ));
    }

    const updatedOrder = await this.dataSource.transaction(async (manager) => {
      const order = await this.findOrderOrFail(manager, orderId);
      if (!['PENDING', 'PENDING_PROCESSING'].includes(order.status)) {
        throw new BadRequestException(`Order ${orderId} cannot be rejected from status ${order.status}`);
      }

      await this.restoreReservedStock(manager, order);

      order.status = refundAutomated || order.status !== 'PENDING_PROCESSING'
        ? 'REJECTED'
        : 'REFUND_PENDING';

      await manager.save(Order, order);
      return this.findOrderOrFail(manager, orderId);
    });

    this.notificationEventBus.publish({
      type: 'ORDER_REJECTED',
      orderId,
      paymentTransactionId: paymentInfo?.transaction_id,
      refundMethod: paymentInfo?.method ?? null,
      refundStatus: this.resolveRefundStatus(paymentInfo?.method ?? null, updatedOrder.status),
    });
    return updatedOrder;
  }

  async cancelOrder(orderId: number): Promise<Order> {
    const existingOrder = await this.findOrderOrFail(this.dataSource.manager, orderId);
    const paymentInfo = await this.getSuccessfulPaymentInfo(this.dataSource.manager, orderId);

    let refundAutomated = false;
    if (existingOrder.status === 'PENDING_PROCESSING' && paymentInfo?.method) {
      ({ automated: refundAutomated } = await this.paymentService.processRefundIfSupported(
        orderId,
        Number(existingOrder.totalPayment),
        paymentInfo.method,
      ));
    }

    const updatedOrder = await this.dataSource.transaction(async (manager) => {
      const order = await this.findOrderOrFail(manager, orderId);
      if (!['PENDING', 'PENDING_PROCESSING'].includes(order.status)) {
        throw new BadRequestException(`Order ${orderId} cannot be cancelled from status ${order.status}`);
      }

      await this.restoreReservedStock(manager, order);

      order.status = refundAutomated || order.status !== 'PENDING_PROCESSING'
        ? 'CANCELLED'
        : 'REFUND_PENDING';

      await manager.save(Order, order);
      return this.findOrderOrFail(manager, orderId);
    });

    this.notificationEventBus.publish({
      type: 'ORDER_CANCELLED',
      orderId,
      paymentTransactionId: paymentInfo?.transaction_id,
      refundMethod: paymentInfo?.method ?? null,
      refundStatus: this.resolveRefundStatus(paymentInfo?.method ?? null, updatedOrder.status),
    });
    return updatedOrder;
  }

  async cancelCustomerOrder(orderId: number, token: string): Promise<Order> {
    await this.findCustomerOrderOrFail(orderId, token);
    return this.cancelOrder(orderId);
  }

  async getPendingOrders(page = 1, limit = this.defaultPendingPageSize, filters: OrderListFilters = {}) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), this.defaultPendingPageSize);

    const query = this.dataSource.getRepository(Order).createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product')
      .leftJoinAndSelect('order.deliveryInfo', 'deliveryInfo')
      .leftJoinAndSelect('order.invoice', 'invoice')
      .where('order.status IN (:...statuses)', { statuses: ['PENDING', 'PENDING_PROCESSING'] })
      .orderBy('order.status', 'DESC')
      .addOrderBy('order.createdAt', 'ASC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    this.applyOrderListFilters(query, filters);

    const [items, total] = await query.getManyAndCount();

    const orderIds = items.map(o => o.orderID);
    const paymentMethodsMap = await this.getLatestSuccessfulPaymentMethods(orderIds);

    const itemsWithMethod = items.map(item => ({
      ...item,
      paymentMethod: paymentMethodsMap[item.orderID] || null,
    }));

    return {
      items: itemsWithMethod,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getVietqrRefundRequests(page = 1, limit = 30, filters: OrderListFilters = {}) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 30);

    const query = this.dataSource.getRepository(Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product')
      .leftJoinAndSelect('order.deliveryInfo', 'deliveryInfo')
      .leftJoinAndSelect('order.invoice', 'invoice')
      .where('order.status = :status', { status: 'REFUND_PENDING' })
      .orderBy('order.createdAt', 'ASC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    this.applyOrderListFilters(query, {
      ...filters,
      paymentMethod: filters.paymentMethod === 'PAYPAL' || filters.paymentMethod === 'UNPAID'
        ? 'ALL'
        : filters.paymentMethod,
    });

    const [items, total] = await query.getManyAndCount();

    const orderIds = items.map(o => o.orderID);
    const paymentMethodsMap = await this.getLatestSuccessfulPaymentMethods(orderIds);

    const itemsWithMethod = items.map(item => ({
      ...item,
      paymentMethod: paymentMethodsMap[item.orderID] || 'VIETQR',
    }));

    return {
      items: itemsWithMethod,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async confirmVietqrRefund(orderId: number): Promise<Order> {
    const updatedOrder = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { orderID: orderId },
        relations: ['orderItems', 'deliveryInfo', 'invoice'],
      });
      if (!order) {
        throw new NotFoundException(`Order #${orderId} not found`);
      }
      if (order.status !== 'REFUND_PENDING') {
        throw new BadRequestException(`Order #${orderId} is in status ${order.status}, not REFUND_PENDING`);
      }

      // Check if there is a SUCCESS VietQR transaction
      const tx = await manager.query(
        'SELECT transaction_id FROM payment_transactions WHERE order_id = $1 AND method = $2 AND status = $3 LIMIT 1',
        [orderId, 'VIETQR', 'SUCCESS']
      );

      if (tx.length === 0) {
        throw new BadRequestException(`Order #${orderId} does not have a successful VietQR transaction to refund`);
      }

      const transactionId = tx[0].transaction_id;

      // Update payment transaction status to REFUNDED
      await manager.query(
        'UPDATE payment_transactions SET status = $1 WHERE transaction_id = $2',
        ['REFUNDED', transactionId]
      );

      // Update order status to REFUNDED
      order.status = 'REFUNDED';
      await manager.save(Order, order);

      return order;
    });
    this.notificationEventBus.publish({
      type: 'ORDER_CANCELLED',
      orderId,
      refundMethod: 'VIETQR',
      refundStatus: 'REFUNDED',
    });
    return updatedOrder;
  }

  private async findCustomerOrderOrFail(orderId: number, token: string): Promise<Order> {
    if (!token?.trim()) {
      throw new BadRequestException('Missing customer order access token');
    }

    const order = await this.dataSource.getRepository(Order).findOne({
      where: {
        orderID: orderId,
        customerAccessToken: token,
      },
      relations: ['orderItems', 'orderItems.product', 'deliveryInfo', 'invoice'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} was not found for this access token`);
    }

    return order;
  }

  private async getSuccessfulPaymentInfo(
    manager: EntityManager,
    orderId: number,
  ): Promise<{ transaction_id: number; method: string } | null> {
    const txs = await manager.query(
      'SELECT transaction_id, method FROM payment_transactions WHERE order_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [orderId, 'SUCCESS'],
    );
    return txs.length > 0 ? txs[0] : null;
  }

  private async getLatestSuccessfulPaymentMethods(orderIds: number[]): Promise<Record<number, string>> {
    const paymentMethodsMap: Record<number, string> = {};
    if (orderIds.length === 0) {
      return paymentMethodsMap;
    }

    const txs = await this.dataSource.manager.query(
      `SELECT DISTINCT ON (order_id) order_id, method
       FROM payment_transactions
       WHERE order_id = ANY($1) AND status = $2
       ORDER BY order_id, created_at DESC`,
      [orderIds, 'SUCCESS'],
    );
    for (const tx of txs) {
      paymentMethodsMap[tx.order_id] = tx.method;
    }
    return paymentMethodsMap;
  }

  private applyOrderListFilters(query: SelectQueryBuilder<Order>, filters: OrderListFilters): void {
    const search = filters.search?.trim();
    if (search) {
      const orderId = Number(search.replace(/^#/, ''));
      const searchPattern = `%${search.toLowerCase()}%`;

      if (Number.isInteger(orderId) && orderId > 0) {
        query.andWhere(
          '(order.orderID = :orderId OR LOWER(deliveryInfo.receiverName) LIKE :search OR LOWER(deliveryInfo.email) LIKE :search OR deliveryInfo.phoneNumber LIKE :search)',
          { orderId, search: searchPattern },
        );
      } else {
        query.andWhere(
          '(LOWER(deliveryInfo.receiverName) LIKE :search OR LOWER(deliveryInfo.email) LIKE :search OR deliveryInfo.phoneNumber LIKE :search)',
          { search: searchPattern },
        );
      }
    }

    const dateRange = filters.dateRange ?? 'ALL';
    if (dateRange !== 'ALL') {
      const startDate = this.resolveDateRangeStart(dateRange);
      if (startDate) {
        query.andWhere('order.createdAt >= :startDate', { startDate });
      }
    }

    const paymentMethod = filters.paymentMethod ?? 'ALL';
    if (paymentMethod === 'PAYPAL' || paymentMethod === 'VIETQR') {
      query.andWhere(
        `(
          SELECT payment_filter.method
          FROM payment_transactions payment_filter
          WHERE payment_filter.order_id = "order"."order_id"
            AND payment_filter.status = :paymentSuccessStatus
          ORDER BY payment_filter.created_at DESC
          LIMIT 1
        ) = :paymentMethod`,
        { paymentSuccessStatus: 'SUCCESS', paymentMethod },
      );
    }

    if (paymentMethod === 'UNPAID') {
      query.andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM payment_transactions payment_filter
          WHERE payment_filter.order_id = "order"."order_id"
            AND payment_filter.status = :paymentSuccessStatus
        )`,
        { paymentSuccessStatus: 'SUCCESS' },
      );
    }
  }

  private resolveDateRangeStart(dateRange: OrderListFilters['dateRange']): Date | null {
    const now = new Date();
    if (dateRange === 'TODAY') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (dateRange === 'WEEK') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - 6);
      return start;
    }
    if (dateRange === 'MONTH') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return null;
  }

  private resolveRefundStatus(paymentMethod: string | null, orderStatus: string): string {
    if (paymentMethod === 'PAYPAL') {
      return 'REFUNDED';
    }
    if (paymentMethod === 'VIETQR') {
      return orderStatus === 'REFUNDED' ? 'REFUNDED' : 'REFUND_PENDING';
    }
    return 'No payment refund required';
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

  private async findOrderOrFail(manager: EntityManager, orderId: number): Promise<Order> {
    const order = await manager.findOne(Order, {
      where: { orderID: orderId },
      relations: ['orderItems', 'orderItems.product', 'deliveryInfo', 'invoice'],
    });

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
