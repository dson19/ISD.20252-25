import { ShippingCalculatorService } from './shipping-calculator.service';
import { WeightOnlyShippingStrategy } from '../strategies/weight-shipping.strategy';
import { VolumetricShippingStrategy } from '../strategies/volumetric-shipping.strategy';

describe('ShippingCalculatorService', () => {
  const otherProvince = 'Da Nang';
  const smallSubtotal = 50000; // < 100.000đ → không freeship discount

  describe('WeightOnlyShippingStrategy (chính sách hiện tại)', () => {
    const service = new ShippingCalculatorService(new WeightOnlyShippingStrategy());

    it('tính phí tỉnh khác theo đúng cân nặng thực, bỏ qua kích thước', () => {
      // 30.000 + ceil((2-0.5)/0.5)*2.500 = 30.000 + 3*2.500 = 37.500
      const feeNoDims = service.calculateShippingFee(otherProvince, 2, smallSubtotal);
      const feeWithDims = service.calculateShippingFee(otherProvince, 2, smallSubtotal, {
        length: 50,
        width: 60,
        height: 10,
      });

      expect(feeNoDims).toBe(37500);
      expect(feeWithDims).toBe(37500);
    });

    it('áp freeship discount tối đa khi subtotal > 100.000đ', () => {
      // base 37.500 - 25.000 = 12.500
      const fee = service.calculateShippingFee(otherProvince, 2, 150000);
      expect(fee).toBe(12500);
    });
  });

  describe('VolumetricShippingStrategy (mở rộng #3)', () => {
    const service = new ShippingCalculatorService(new VolumetricShippingStrategy());

    it('dùng trọng lượng quy đổi thể tích khi lớn hơn cân nặng thực', () => {
      // L×W×H/6000 = 50*60*10/6000 = 5kg > 2kg thực
      // 30.000 + ceil((5-0.5)/0.5)*2.500 = 30.000 + 9*2.500 = 52.500
      const fee = service.calculateShippingFee(otherProvince, 2, smallSubtotal, {
        length: 50,
        width: 60,
        height: 10,
      });
      expect(fee).toBe(52500);
    });

    it('quy về cân nặng thực khi không có kích thước', () => {
      const fee = service.calculateShippingFee(otherProvince, 2, smallSubtotal);
      expect(fee).toBe(37500);
    });
  });
});
