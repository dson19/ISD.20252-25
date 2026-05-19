import { ForbiddenException } from '@nestjs/common';

export class ProductHiddenException extends ForbiddenException {
  constructor(productID: number) {
    super(`Product ${productID} is hidden from customers`);
  }
}
