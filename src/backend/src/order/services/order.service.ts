import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { CartItemDto } from '../dto/cart-item.dto';
import { DeliveryInfoDto } from '../dto/delivery-info.dto';
import { DeliveryInfo } from '../entities/delivery-info.entity';
import { Invoice } from '../entities/invoice.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { CartStockIssue, CartService } from './cart.service';
import { ShippingCalculatorService } from './shipping-calculator.service';

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Communicates via validated DTOs, primitive order parameters, and repository states.
 *   - Procedural Cohesion: Sequences complex order validations, shipping calculations, and entity persistence steps inside placeOrder().
 * + Reason why:
 *   - Delegating shipping calculations and cart validations to dedicated services ensures the ordering service maintains a clean, single procedural focus.
 */
@Injectable()
export class OrderService {
  private readonly defaultPendingPageSize = 30;

  constructor(
    private readonly dataSource: DataSource,
    private readonly cartService: CartService,
    private readonly shippingCalculatorService: ShippingCalculatorService,
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
    const txs = await this.dataSource.manager.query(
      'SELECT method FROM payment_transactions WHERE order_id = $1 AND status = $2 LIMIT 1',
      [orderId, 'SUCCESS']
    );
    const paymentMethod = txs.length > 0 ? txs[0].method : null;
    return {
      ...order,
      paymentMethod
    };
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
    return this.findOrderOrFail(this.dataSource.manager, orderId);
  }

  async rejectOrder(orderId: number): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.findOrderOrFail(manager, orderId);
      if (!['PENDING', 'PENDING_PROCESSING'].includes(order.status)) {
        throw new BadRequestException(`Order ${orderId} cannot be rejected from status ${order.status}`);
      }

      await this.restoreReservedStock(manager, order);

      // Check payment method
      const txs = await manager.query(
        'SELECT method FROM payment_transactions WHERE order_id = $1 AND status = $2 LIMIT 1',
        [orderId, 'SUCCESS']
      );
      const paymentMethod = txs.length > 0 ? txs[0].method : null;

      if (order.status === 'PENDING_PROCESSING' && paymentMethod === 'VIETQR') {
        order.status = 'REFUND_PENDING';
      } else {
        order.status = 'REJECTED';
      }

      await manager.save(Order, order);
      return this.findOrderOrFail(manager, orderId);
    });
  }

  async cancelOrder(orderId: number): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.findOrderOrFail(manager, orderId);
      if (!['PENDING', 'PENDING_PROCESSING'].includes(order.status)) {
        throw new BadRequestException(`Order ${orderId} cannot be cancelled from status ${order.status}`);
      }

      await this.restoreReservedStock(manager, order);

      // Check payment method
      const txs = await manager.query(
        'SELECT method FROM payment_transactions WHERE order_id = $1 AND status = $2 LIMIT 1',
        [orderId, 'SUCCESS']
      );
      const paymentMethod = txs.length > 0 ? txs[0].method : null;

      if (order.status === 'PENDING_PROCESSING' && paymentMethod === 'VIETQR') {
        order.status = 'REFUND_PENDING';
      } else {
        order.status = 'CANCELLED';
      }

      await manager.save(Order, order);
      return this.findOrderOrFail(manager, orderId);
    });
  }

  async getPendingOrders(page = 1, limit = this.defaultPendingPageSize) {
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

    const [items, total] = await query.getManyAndCount();

    // Fetch paymentMethod for each order
    const orderIds = items.map(o => o.orderID);
    let paymentMethodsMap: Record<number, string> = {};
    if (orderIds.length > 0) {
      const txs = await this.dataSource.manager.query(
        'SELECT order_id, method FROM payment_transactions WHERE order_id = ANY($1) AND status = $2',
        [orderIds, 'SUCCESS']
      );
      for (const tx of txs) {
        paymentMethodsMap[tx.order_id] = tx.method;
      }
    }

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

  async getVietqrRefundRequests(page = 1, limit = 30) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 30);

    const [items, total] = await this.dataSource.getRepository(Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product')
      .leftJoinAndSelect('order.deliveryInfo', 'deliveryInfo')
      .leftJoinAndSelect('order.invoice', 'invoice')
      .where('order.status = :status', { status: 'REFUND_PENDING' })
      .orderBy('order.createdAt', 'ASC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    // Fetch paymentMethod for each order
    const orderIds = items.map(o => o.orderID);
    let paymentMethodsMap: Record<number, string> = {};
    if (orderIds.length > 0) {
      const txs = await this.dataSource.manager.query(
        'SELECT order_id, method FROM payment_transactions WHERE order_id = ANY($1) AND status = $2',
        [orderIds, 'SUCCESS']
      );
      for (const tx of txs) {
        paymentMethodsMap[tx.order_id] = tx.method;
      }
    }

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
    return this.dataSource.transaction(async (manager) => {
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
}
