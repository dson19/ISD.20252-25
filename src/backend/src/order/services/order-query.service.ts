import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderRepository } from '../order.repository';

export interface OrderListFilters {
  search?: string;
  dateRange?: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
  // 'ALL'/'UNPAID' là token đặc biệt; mọi giá trị khác là tên phương thức (PAYPAL/VIETQR/VNPay…).
  // Để string ở đây để thêm cổng mới không phải sửa kiểu (OCP).
  paymentMethod?: 'ALL' | 'UNPAID' | (string & {});
}

/**
 * + Coupling/Cohesion level:
 *   - Functional Cohesion: Chỉ lo TRUY VẤN danh sách đơn (pending + chờ hoàn tiền) cho Product Manager.
 * + SOLID Principles Review:
 *   - SRP Adherence: Tách khỏi OrderService để OrderService chỉ lo vòng đời đơn; service này chỉ đọc.
 *   - OCP Adherence: Lọc theo phương thức thanh toán so khớp tên động (không if PAYPAL/VIETQR) →
 *     thêm cổng mới không phải sửa hàm lọc.
 *   - DIP Adherence: Phụ thuộc OrderRepository (query builder + map phương thức), không tự viết SQL.
 */
@Injectable()
export class OrderQueryService {
  private readonly defaultPendingPageSize = 30;

  constructor(private readonly orderRepository: OrderRepository) {}

  async getPendingOrders(page = 1, limit = this.defaultPendingPageSize, filters: OrderListFilters = {}) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), this.defaultPendingPageSize);

    const query = this.orderRepository.buildPendingQuery()
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    this.applyOrderListFilters(query, filters);

    return this.paginate(query, safePage, safeLimit, null);
  }

  async getVietqrRefundRequests(page = 1, limit = 30, filters: OrderListFilters = {}) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 30);

    const query = this.orderRepository.buildRefundPendingQuery()
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    // Danh sách này chỉ gồm đơn VietQR chờ hoàn tiền tay → bỏ lọc theo các phương thức không liên quan.
    this.applyOrderListFilters(query, {
      ...filters,
      paymentMethod: filters.paymentMethod === 'VIETQR' ? 'VIETQR' : 'ALL',
    });

    return this.paginate(query, safePage, safeLimit, 'VIETQR');
  }

  private async paginate(
    query: SelectQueryBuilder<Order>,
    page: number,
    limit: number,
    fallbackMethod: string | null,
  ) {
    const [items, total] = await query.getManyAndCount();

    const orderIds = items.map((o) => o.orderID);
    const paymentMethodsMap = await this.orderRepository.getLatestSuccessfulPaymentMethods(orderIds);

    const itemsWithMethod = items.map((item) => ({
      ...item,
      paymentMethod: paymentMethodsMap[item.orderID] || fallbackMethod,
    }));

    return {
      items: itemsWithMethod,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
    if (paymentMethod !== 'ALL' && paymentMethod !== 'UNPAID') {
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
}
