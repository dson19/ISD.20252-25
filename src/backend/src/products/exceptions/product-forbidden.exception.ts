import { ForbiddenException } from '@nestjs/common';

export class ProductForbiddenException extends ForbiddenException {
  constructor(productID: number) {
    super(`Product ${productID} is not visible for the current user`);
  }
}
