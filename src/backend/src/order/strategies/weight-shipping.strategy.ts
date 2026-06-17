import { ShippingStrategy } from '../interfaces/shipping-strategy.interface';

export class WeightOnlyShippingStrategy implements ShippingStrategy {
  calculateFee(params: { weight: number; baseFee: number }): number {
    return params.baseFee;
  }
}
