import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
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
  validateBookFields(data: any): boolean {
    if (data.action === 'UPDATE' && (!data.updatedData?.author || !data.updatedData?.coverType)) {
      throw new BadRequestException('Validation failed: Book missing mandatory fields.');
    }
    return true;
  }

  validateNewspaperFields(data: any): boolean {
    if (data.action === 'UPDATE' && (!data.updatedData?.editorInChief || !data.updatedData?.publisher)) {
      throw new BadRequestException('Validation failed: Newspaper missing mandatory fields.');
    }
    return true;
  }

  validateCDFields(data: any): boolean {
    if (data.action === 'UPDATE' && (!data.updatedData?.tracksList || data.updatedData.tracksList.length === 0)) {
      throw new BadRequestException('Validation failed: CD missing tracks list.');
    }
    return true;
  }

  validateDVDFields(data: any): boolean {
    if (data.action === 'UPDATE' && (!data.updatedData?.discType || !data.updatedData?.director)) {
      throw new BadRequestException('Validation failed: DVD missing mandatory fields.');
    }
    return true;
  }

  async createProduct(dto: any): Promise<any> {
    const existingProduct = await this.productRepository.findByBarcode(dto.barcode);

    if (existingProduct) {
      throw new ConflictException(`Product with barcode ${dto.barcode} already exists.`);
    }

    if (!dto.title || dto.title.trim() === '') {
      throw new BadRequestException('Product title cannot be empty.');
    }

    switch (dto.type) {
      case 'Book': this.validateBookFields(dto); break;
      case 'Newspaper': this.validateNewspaperFields(dto); break;
      case 'CD': this.validateCDFields(dto); break;
      case 'DVD': this.validateDVDFields(dto); break;
    }

    const newProduct = this.productRepository.create(dto);

    return this.productRepository.save(newProduct);
  }

  async handleUpdate(id: number, dto: any): Promise<any> {
    const product = await this.productRepository.findOne(id);

    if (!product) {
      throw new ProductNotFoundException(id);
    }

    const currentPrice = dto.newPrice !== undefined ? dto.newPrice : dto.currentPrice;
    const originalValue = dto.originalPrice !== undefined ? dto.originalPrice : product.originalValue;

    if (currentPrice !== undefined && originalValue !== undefined) {
      const minPrice = originalValue * 0.3;
      const maxPrice = originalValue * 1.5;

      if (currentPrice < minPrice || currentPrice > maxPrice) {
        throw new BadRequestException('Update price is out of allowed bounds (30% - 150%).');
      }
    }

    if (dto.type) {
      const payload = { action: 'UPDATE', updatedData: dto };
      switch (dto.type) {
        case 'Book': this.validateBookFields(payload); break;
        case 'Newspaper': this.validateNewspaperFields(payload); break;
        case 'CD': this.validateCDFields(payload); break;
        case 'DVD': this.validateDVDFields(payload); break;
      }
    }

    Object.assign(product, dto);

    return this.productRepository.save(product);
  }

  async handleDeletion(productIDs: number[] | number): Promise<boolean> {
    const ids = Array.isArray(productIDs) ? productIDs : [productIDs];

    if (ids.length === 0) {
      return false;
    }

    if (ids.length > 10) {
      throw new BadRequestException('Cannot delete more than 10 products simultaneously.');
    }

    if (typeof this.productRepository.getDailyDeletionCount === 'function') {
      const dailyDeletions = await this.productRepository.getDailyDeletionCount();
      
      if (dailyDeletions + ids.length > 20) {
        throw new ForbiddenException('Exceeds daily security limit threshold of 20 products.');
      }
    }

    for (const id of ids) {
      const product = await this.productRepository.findOne(id);

      if (!product) {
        throw new ProductNotFoundException(id);
      }

      const isLinkedToOrder = await this.productRepository.checkInOrders(id);

      if (isLinkedToOrder) {
        throw new ConflictException(`Cannot delete product ${id} because it is currently in an order.`);
      }

      if (product.quantityInStock !== undefined && product.quantityInStock > 0) {
        product.status = 'deactivated';
        await this.productRepository.save(product);
      } else {
        await this.productRepository.delete(id);
      }
    }

    return true;
  }
}
