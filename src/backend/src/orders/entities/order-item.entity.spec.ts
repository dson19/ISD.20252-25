import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';
import { OrderItem } from './order-item.entity';

describe('OrderItem.calculateSubTotal', () => {
  it('O_TC01 returns quantity multiplied by a valid unit price', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: 4,
      unitPrice: 30000,
    });

    expect(item.calculateSubTotal()).toBe(120000);
  });

  it('O_TC02a throws InvalidQuantityException when quantity is zero', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: 0,
      unitPrice: 30000,
    });

    expect(() => item.calculateSubTotal()).toThrow(InvalidQuantityException);
  });

  it('O_TC02b throws InvalidQuantityException when quantity is negative', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: -1,
      unitPrice: 30000,
    });

    expect(() => item.calculateSubTotal()).toThrow(InvalidQuantityException);
  });
});
