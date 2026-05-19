import { Inject, Injectable } from '@nestjs/common';
import type { ProductDTO } from './domain/product.entity';
import { normalizeUserRole, UserRole } from './domain/user-role.enum';
import { ProductHiddenException } from './exceptions/product-hidden.exception';
import { ProductNotFoundException } from './exceptions/product-not-found.exception';
import { PRODUCT_REPOSITORY } from './product.repository';
import type { ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async viewProductDetails(
    productID: number,
    userRole: string = UserRole.Customer,
  ): Promise<ProductDTO> {
    const product = await this.productRepository.findOne(productID);

    if (!product) {
      throw new ProductNotFoundException(productID);
    }

    if (!product.isViewableBy(normalizeUserRole(userRole))) {
      throw new ProductHiddenException(productID);
    }

    return product.toDTO();
  }

  async findProductDetail(
    productID: number,
    userRole: string = UserRole.Customer,
  ): Promise<ProductDTO> {
    return this.viewProductDetails(productID, userRole);
  }

  async getProductDetail(
    productID: number,
    userRole: string = UserRole.Customer,
  ): Promise<ProductDTO> {
    return this.viewProductDetails(productID, userRole);
  }
}
