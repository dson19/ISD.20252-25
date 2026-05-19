import { Injectable } from '@nestjs/common';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { InsufficientStockException } from '../exceptions/insufficient-stock.exception';
import { InventoryService } from '../interfaces/inventory-service.interface';

type PlaceOrderRequest = {
  items: OrderItem[];
  shippingFee: number;
};

@Injectable()
export class OrderService {
  constructor(private readonly inventoryService: InventoryService) {}

  async requestToPlaceOrder(request: PlaceOrderRequest): Promise<Order> {
    for (const item of request.items) {
      const hasEnoughStock = await this.inventoryService.hasEnoughStock(
        item.productId,
        item.quantity,
      );

      if (!hasEnoughStock) {
        throw new InsufficientStockException(item.productId);
      }
    }

    for (const item of request.items) {
      await this.inventoryService.reserveStock(item.productId, item.quantity);
    }

    return new Order({
      items: request.items,
      shippingFee: request.shippingFee,
      status: OrderStatus.Pending,
    });
  }
}
