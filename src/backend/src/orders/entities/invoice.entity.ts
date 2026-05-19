import { InvalidPriceException } from '../exceptions/invalid-price.exception';

export class Invoice {
  private static readonly freeShippingThreshold = 100000;
  private static readonly maxShippingDiscount = 25000;

  calculateTotalAmount(subtotal: number, shippingFee: number): number {
    if (subtotal < 0) {
      throw new InvalidPriceException('Subtotal must not be negative');
    }

    if (shippingFee < 0) {
      throw new InvalidPriceException('Shipping fee must not be negative');
    }

    const shippingDiscount =
      subtotal > Invoice.freeShippingThreshold
        ? Math.min(shippingFee, Invoice.maxShippingDiscount)
        : 0;

    return subtotal + shippingFee - shippingDiscount;
  }
}
