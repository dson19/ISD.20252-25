import { InvalidPriceException } from '../exceptions/invalid-price.exception';
import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';
import { OrderItem } from './order-item.entity';

describe('OrderItem.calculateSubTotal', () => {
  it('O_TC01 CalculateSubtotalNormal returns subtotal for positive integers [EP]', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: 4,
      unitPrice: 30000,
    });

    expect(item.calculateSubTotal()).toBe(120000);
  });

  it('O_TC02 CalculateSubtotalMinBound returns subtotal at minimum valid boundary [BVA]', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: 1,
      unitPrice: 1,
    });

    expect(item.calculateSubTotal()).toBe(1);
  });

  it('O_TC03 CalculateSubtotalZeroQty throws when quantity is exactly 0 [BVA]', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: 0,
      unitPrice: 30000,
    });

    expect(() => item.calculateSubTotal()).toThrow(InvalidQuantityException);
  });

  it('O_TC04 CalculateSubtotalNegativeQty throws when quantity is negative [EP]', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: -5,
      unitPrice: 30000,
    });

    expect(() => item.calculateSubTotal()).toThrow(InvalidQuantityException);
  });

  it('O_TC05 CalculateSubtotalZeroUnitPrice throws when unit price is exactly 0 [BVA]', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: 2,
      unitPrice: 0,
    });

    expect(() => item.calculateSubTotal()).toThrow(InvalidPriceException);
  });

  it('O_TC06 CalculateSubtotalNegativeUnitPrice throws when unit price is negative [EP]', () => {
    const item = new OrderItem({
      productId: 'book-001',
      quantity: 2,
      unitPrice: -15000,
    });

    expect(() => item.calculateSubTotal()).toThrow(InvalidPriceException);
  });
});
