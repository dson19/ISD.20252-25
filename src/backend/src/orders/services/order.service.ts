import { Injectable } from '@nestjs/common';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { InsufficientStockException } from '../exceptions/insufficient-stock.exception';
import { ProductRepository } from '../interfaces/product-repository.interface';

type PlaceOrderRequest = {
  items: OrderItem[];
  shippingFee: number;
};

@Injectable()
export class OrderService {
  constructor(private readonly productRepository: ProductRepository) {}

  async requestToPlaceOrder(request: PlaceOrderRequest): Promise<Order> {
    for (const item of request.items) {
      const hasEnoughStock = await this.productRepository.hasEnoughStock(
        item.productId,
        item.quantity,
      );

      if (!hasEnoughStock) {
        throw new InsufficientStockException(item.productId);
      }
    }

    for (const item of request.items) {
      await this.productRepository.reserveStock(item.productId, item.quantity);
    }

    return new Order({
      items: request.items,
      shippingFee: request.shippingFee,
      status: OrderStatus.Pending,
    });
  }
}
