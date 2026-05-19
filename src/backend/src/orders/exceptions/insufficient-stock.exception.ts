export class InsufficientStockException extends Error {
  constructor(productId: string) {
    super(`Insufficient stock for product: ${productId}`);
    this.name = InsufficientStockException.name;
  }
}
