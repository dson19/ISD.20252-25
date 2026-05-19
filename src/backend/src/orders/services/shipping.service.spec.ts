import { ShippingService } from './shipping.service';

describe('ShippingService.calculateShippingFee', () => {
  it('O_TC29 CalculateShippingFeeHnHcmBaseEdge returns base fee at exactly 3kg [BVA]', () => {
    const service = new ShippingService();

    expect(service.calculateShippingFee('Ha Noi', 3.0)).toBe(22000);
  });

  it('O_TC30 CalculateShippingFeeHnHcmProgressive adds one block fee above 3kg [BVA]', () => {
    const service = new ShippingService();

    expect(service.calculateShippingFee('Ha Noi', 3.5)).toBe(24500);
  });

  it('O_TC31 CalculateShippingFeeOtherBaseEdge returns other-province base fee at exactly 0.5kg [BVA]', () => {
    const service = new ShippingService();

    expect(service.calculateShippingFee('Da Nang', 0.5)).toBe(30000);
  });

  it('O_TC32 CalculateShippingFeeOtherProgressive adds one block fee above 0.5kg [BVA]', () => {
    const service = new ShippingService();

    expect(service.calculateShippingFee('Da Nang', 1.0)).toBe(32500);
  });
});
