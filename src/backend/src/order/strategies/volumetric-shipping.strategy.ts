import { ShippingStrategy } from '../interfaces/shipping-strategy.interface';

export class VolumetricShippingStrategy implements ShippingStrategy {
  calculateFee(params: {
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    baseFee: number;
  }): number {
    const { weight, length = 0, width = 0, height = 0, baseFee } = params;
    const volumetricWeight = (length * width * height) / 6000;
    const effectiveWeight = Math.max(weight, volumetricWeight);

    if (weight <= 0) {
      return baseFee;
    }

    const ratio = effectiveWeight / weight;
    return Math.round(baseFee * ratio);
  }
}
