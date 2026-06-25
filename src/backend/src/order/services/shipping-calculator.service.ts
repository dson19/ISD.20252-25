import { Inject, Injectable } from '@nestjs/common';
import type { ShippingStrategy } from '../interfaces/shipping-strategy.interface';
import { SHIPPING_STRATEGY } from '../interfaces/shipping-strategy.interface';

/**
 * + Coupling/Cohesion level:
 *   - Data Coupling: Receives only primitive parameters (`province`, `totalWeight`, `subtotal`) to perform its calculations.
 *   - Functional Cohesion: Exclusively focused on calculating order shipping fees based on weight and geographic factors.
 *
 * + SOLID Principles Review:
 *   - OCP: Cách tính TRỌNG LƯỢNG tính phí được uỷ cho ShippingStrategy (DI qua token SHIPPING_STRATEGY).
 *     Đổi từ tính theo cân nặng thực sang tính theo thể tích (#3) = đổi binding strategy ở module,
 *     KHÔNG sửa service này. Biểu phí theo vùng (HN/HCM vs tỉnh khác) vẫn áp lên trọng lượng tính phí.
 *   - DIP: Phụ thuộc abstraction ShippingStrategy, không phụ thuộc implementation cụ thể.
 */
@Injectable()
export class ShippingCalculatorService {
  private readonly freeShippingThreshold = 100000;
  private readonly maxShippingDiscount = 25000;
  private readonly extraHalfKgFee = 2500;

  constructor(
    @Inject(SHIPPING_STRATEGY)
    private readonly strategy: ShippingStrategy,
  ) {}

  calculateShippingFee(province: string, totalWeight: number, subtotal: number, dimensions?: { length?: number; width?: number; height?: number }): number {
    const normalizedProvince = this.normalizeProvince(province);
    const actualWeight = Math.max(totalWeight, 0);
    const chargeableWeight = Math.max(
      this.strategy.calculateChargeableWeight(actualWeight, dimensions),
      0,
    );

    const baseFee = this.isInnerCity(normalizedProvince)
      ? this.calculateInnerCityFee(chargeableWeight)
      : this.calculateOtherProvinceFee(chargeableWeight);

    if (subtotal > this.freeShippingThreshold) {
      return Math.max(baseFee - this.maxShippingDiscount, 0);
    }

    return baseFee;
  }

  private calculateInnerCityFee(weight: number): number {
    if (weight <= 3) {
      return 22000;
    }

    return 22000 + Math.ceil((weight - 3) / 0.5) * this.extraHalfKgFee;
  }

  private calculateOtherProvinceFee(weight: number): number {
    if (weight <= 0.5) {
      return 30000;
    }

    return 30000 + Math.ceil((weight - 0.5) / 0.5) * this.extraHalfKgFee;
  }

  private isInnerCity(province: string): boolean {
    return [
      'ha noi',
      'hanoi',
      'hn',
      'tp hcm',
      'tp ho chi minh',
      'tphcm',
      'ho chi minh',
      'ho chi minh city',
      'hcm',
    ].includes(province);
  }

  private normalizeProvince(province: string): string {
    return province
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[.\s]+/g, ' ')
      .trim();
  }
}
