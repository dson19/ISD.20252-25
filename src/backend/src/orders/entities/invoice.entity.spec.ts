import { InvalidPriceException } from '../exceptions/invalid-price.exception';
import { Invoice } from './invoice.entity';

describe('Invoice.calculateTotalAmount', () => {
  it('O_TC07 AggregateGrandTotalNormal returns subtotal plus shipping fee [EP]', () => {
    const invoice = new Invoice();

    expect(invoice.calculateTotalAmount(80000, 22000)).toBe(102000);
  });

  it('O_TC08 AggregateTotalNegativeShippingError throws for negative shipping fee [EP]', () => {
    const invoice = new Invoice();

    expect(() => invoice.calculateTotalAmount(500000, -10000)).toThrow(
      InvalidPriceException,
    );
  });

  it('O_TC09 AggregateTotalNegativeSubtotalError throws for negative subtotal [EP]', () => {
    const invoice = new Invoice();

    expect(() => invoice.calculateTotalAmount(-50000, 45000)).toThrow(
      InvalidPriceException,
    );
  });

  it('O_TC10 AggregateTotalWithFullFreeShipDiscount covers shipping below max discount [Decision Table]', () => {
    const invoice = new Invoice();

    expect(invoice.calculateTotalAmount(150000, 22000)).toBe(150000);
  });

  it('O_TC11 AggregateTotalWithMaxFreeShipDiscount caps shipping discount at 25k [Decision Table]', () => {
    const invoice = new Invoice();

    expect(invoice.calculateTotalAmount(150000, 30000)).toBe(155000);
  });

  it('O_TC12 AggregateTotalAtFreeShipThresholdBound applies no discount at exactly 100k [BVA]', () => {
    const invoice = new Invoice();

    expect(invoice.calculateTotalAmount(100000, 22000)).toBe(122000);
  });
});
