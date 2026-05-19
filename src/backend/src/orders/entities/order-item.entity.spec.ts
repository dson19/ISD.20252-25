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

  it('O_TC02 throws InvalidQuantityException when quantity is zero or negative', () => {
    const zeroQuantityItem = new OrderItem({
      productId: 'book-001',
      quantity: 0,
      unitPrice: 30000,
    });
    const negativeQuantityItem = new OrderItem({
      productId: 'book-001',
      quantity: -1,
      unitPrice: 30000,
    });

    expect(() => zeroQuantityItem.calculateSubTotal()).toThrow(
      InvalidQuantityException,
    );
    expect(() => negativeQuantityItem.calculateSubTotal()).toThrow(
      InvalidQuantityException,
    );
  });
});
