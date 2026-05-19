export class InvalidPriceException extends Error {
  constructor(message = 'Price value must be greater than or equal to zero') {
    super(message);
    this.name = InvalidPriceException.name;
  }
}
