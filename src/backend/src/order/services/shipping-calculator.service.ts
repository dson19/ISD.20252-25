import { Injectable } from '@nestjs/common';

/**
 * ShippingCalculatorService - Tinh phi van chuyen cho quy trinh dat hang.
 *
 * COHESION: Functional Cohesion
 * Lop nay chi chiu trach nhiem tinh phi ship dua tren tinh/thanh, tong khoi luong,
 * va tong gia tri hang hoa. OrderService khong phai chua cac cong thuc van chuyen.
 *
 * COUPLING: Low Data Coupling
 * Service nhan cac gia tri vo huong can thiet thay vi nhan ca Order, Cart, hay request object.
 */
@Injectable()
export class ShippingCalculatorService {
  private readonly freeShippingThreshold = 100000;
  private readonly maxShippingDiscount = 25000;
  private readonly extraHalfKgFee = 2500;

  calculateShippingFee(province: string, totalWeight: number, subtotal: number): number {
    const normalizedProvince = this.normalizeProvince(province);
    const weight = Math.max(totalWeight, 0);
    const baseFee = this.isInnerCity(normalizedProvince)
      ? this.calculateInnerCityFee(weight)
      : this.calculateOtherProvinceFee(weight);

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
