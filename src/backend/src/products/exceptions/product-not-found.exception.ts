import { NotFoundException } from '@nestjs/common';

export class ProductNotFoundException extends NotFoundException {
  constructor(productID: number) {
    super(`Product ${productID} was not found`);
  }
}
