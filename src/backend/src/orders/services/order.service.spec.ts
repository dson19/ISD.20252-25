import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../entities/order.entity';
import { InsufficientStockException } from '../exceptions/insufficient-stock.exception';
import { InventoryService } from '../interfaces/inventory-service.interface';
import { OrderService } from './order.service';

describe('OrderService.requestToPlaceOrder', () => {
  const items = [
    new OrderItem({
      productId: 'book-001',
      quantity: 2,
      unitPrice: 100000,
    }),
    new OrderItem({
      productId: 'dvd-001',
      quantity: 1,
      unitPrice: 300000,
    }),
  ];

  it('O_TC04 creates a pending order and reserves stock when all items are available', async () => {
    const inventoryService: jest.Mocked<InventoryService> = {
      hasEnoughStock: jest.fn().mockResolvedValue(true),
      reserveStock: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrderService(inventoryService);

    const order = await service.requestToPlaceOrder({
      items,
      shippingFee: 45000,
    });

    expect(order.status).toBe(OrderStatus.Pending);
    expect(inventoryService.hasEnoughStock).toHaveBeenCalledTimes(2);
    expect(inventoryService.reserveStock).toHaveBeenCalledTimes(2);
    expect(inventoryService.reserveStock).toHaveBeenNthCalledWith(
      1,
      'book-001',
      2,
    );
    expect(inventoryService.reserveStock).toHaveBeenNthCalledWith(
      2,
      'dvd-001',
      1,
    );
  });

  it('O_TC05 throws InsufficientStockException and does not reserve stock when any item is unavailable', async () => {
    const inventoryService: jest.Mocked<InventoryService> = {
      hasEnoughStock: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      reserveStock: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrderService(inventoryService);

    await expect(
      service.requestToPlaceOrder({
        items,
        shippingFee: 45000,
      }),
    ).rejects.toThrow(InsufficientStockException);

    expect(inventoryService.reserveStock).not.toHaveBeenCalled();
  });
});
