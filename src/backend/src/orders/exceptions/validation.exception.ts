export class ValidationException extends Error {
  constructor(message = 'Invalid delivery information') {
    super(message);
    this.name = ValidationException.name;
  }
}
