import { Injectable } from '@nestjs/common';

@Injectable()
export class ShippingService {
  private static readonly hanoiOrHcmBaseWeight = 3;
  private static readonly hanoiOrHcmBaseFee = 22000;
  private static readonly otherProvinceBaseWeight = 0.5;
  private static readonly otherProvinceBaseFee = 30000;
  private static readonly extraBlockWeight = 0.5;
  private static readonly extraBlockFee = 2500;

  calculateShippingFee(province: string, weight: number): number {
    const isMajorCity = this.isHaNoiOrHoChiMinh(province);
    const baseWeight = isMajorCity
      ? ShippingService.hanoiOrHcmBaseWeight
      : ShippingService.otherProvinceBaseWeight;
    const baseFee = isMajorCity
      ? ShippingService.hanoiOrHcmBaseFee
      : ShippingService.otherProvinceBaseFee;

    if (weight <= baseWeight) {
      return baseFee;
    }

    const extraBlocks = Math.ceil(
      (weight - baseWeight) / ShippingService.extraBlockWeight,
    );

    return baseFee + extraBlocks * ShippingService.extraBlockFee;
  }

  private isHaNoiOrHoChiMinh(province: string): boolean {
    const normalizedProvince = province.trim().toLowerCase();

    return [
      'ha noi',
      'hanoi',
      'hn',
      'ho chi minh',
      'ho chi minh city',
      'hcm',
      'tp hcm',
    ].includes(normalizedProvince);
  }
}
