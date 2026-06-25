/**
 * Strategy xác định TRỌNG LƯỢNG TÍNH PHÍ (chargeable weight) của đơn.
 * - Mặc định (#hiện tại): chỉ tính theo cân nặng thực.
 * - Mở rộng (#3): tính theo MAX(cân nặng thực, trọng lượng quy đổi thể tích L×W×H/6000).
 *
 * Biểu phí theo vùng (HN/HCM vs tỉnh khác) nằm ở ShippingCalculatorService và áp lên
 * trọng lượng tính phí do strategy trả về → đổi cách tính trọng lượng = đổi strategy,
 * không sửa biểu phí.
 */
export interface ShippingStrategy {
  calculateChargeableWeight(
    actualWeight: number,
    dimensions?: { length?: number; width?: number; height?: number },
  ): number;
}

export const SHIPPING_STRATEGY = Symbol('SHIPPING_STRATEGY');
