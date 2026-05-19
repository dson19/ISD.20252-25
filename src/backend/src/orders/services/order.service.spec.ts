import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../entities/order.entity';
import { InsufficientStockException } from '../exceptions/insufficient-stock.exception';
import { ProductRepository } from '../interfaces/product-repository.interface';
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

  it('O_TC13 RequestPlaceOrderStockAvailable creates pending order when all items are in stock [Decision Table]', async () => {
    const productRepository: jest.Mocked<ProductRepository> = {
      hasEnoughStock: jest.fn().mockResolvedValue(true),
      reserveStock: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrderService(productRepository);

    const order = await service.requestToPlaceOrder({
      items,
      shippingFee: 45000,
    });

    expect(order.status).toBe(OrderStatus.Pending);
    expect(productRepository.hasEnoughStock).toHaveBeenCalledTimes(2);
    expect(productRepository.reserveStock).toHaveBeenCalledTimes(2);
  });

  it('O_TC14 RequestPlaceOrderStockShortage throws when any item is out of stock [Decision Table]', async () => {
    const productRepository: jest.Mocked<ProductRepository> = {
      hasEnoughStock: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      reserveStock: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrderService(productRepository);

    await expect(
      service.requestToPlaceOrder({
        items,
        shippingFee: 45000,
      }),
    ).rejects.toThrow(InsufficientStockException);

    expect(productRepository.reserveStock).not.toHaveBeenCalled();
  });
});
