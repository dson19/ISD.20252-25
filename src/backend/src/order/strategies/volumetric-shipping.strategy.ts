import { Injectable } from '@nestjs/common';
import { ShippingStrategy } from '../interfaces/shipping-strategy.interface';

/**
 * Mở rộng (#3): trọng lượng tính phí = MAX(cân nặng thực, trọng lượng quy đổi thể tích).
 * Quy đổi thể tích theo chuẩn vận chuyển: L×W×H (cm) / 6000 = kg.
 * Không có kích thước → quy về cân nặng thực (hành xử như WeightOnly).
 */
@Injectable()
export class VolumetricShippingStrategy implements ShippingStrategy {
  calculateChargeableWeight(
    actualWeight: number,
    dimensions?: { length?: number; width?: number; height?: number },
  ): number {
    const { length = 0, width = 0, height = 0 } = dimensions ?? {};
    const volumetricWeight = (length * width * height) / 6000;
    return Math.max(actualWeight, volumetricWeight);
  }
}
