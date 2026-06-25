import { Injectable } from '@nestjs/common';
import { ShippingStrategy } from '../interfaces/shipping-strategy.interface';

/**
 * Chính sách hiện tại: tính phí theo đúng cân nặng thực, bỏ qua kích thước.
 */
@Injectable()
export class WeightOnlyShippingStrategy implements ShippingStrategy {
  calculateChargeableWeight(actualWeight: number): number {
    return actualWeight;
  }
}
