export class InvalidQuantityException extends Error {
  constructor(quantity: number) {
    super(`Invalid order item quantity: ${quantity}`);
    this.name = InvalidQuantityException.name;
  }
}
