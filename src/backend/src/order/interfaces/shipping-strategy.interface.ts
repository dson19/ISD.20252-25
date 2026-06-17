export interface ShippingStrategy {
  calculateFee(params: {
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    baseFee: number;
  }): number;
}
