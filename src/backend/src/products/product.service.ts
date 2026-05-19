import { Inject, Injectable } from '@nestjs/common';
import type { ProductDetail } from './domain/product.entity';
import { UserRole } from './domain/user-role.enum';
import { ProductForbiddenException } from './exceptions/product-forbidden.exception';
import { ProductNotFoundException } from './exceptions/product-not-found.exception';
import { PRODUCT_REPOSITORY } from './product.repository';
import type { ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async findProductDetail(
    productID: number,
    userRole: UserRole = UserRole.Customer,
  ): Promise<ProductDetail> {
    const product = await this.productRepository.findOne(productID);

    if (!product) {
      throw new ProductNotFoundException(productID);
    }

    if (!product.isViewableBy(userRole)) {
      throw new ProductForbiddenException(productID);
    }

    return product.toDetail();
  }

  async getProductDetail(
    productID: number,
    userRole: UserRole = UserRole.Customer,
  ): Promise<ProductDetail> {
    return this.findProductDetail(productID, userRole);
  }
}
