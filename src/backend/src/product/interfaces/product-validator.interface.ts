import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Product } from '../entities/product.entity';

export const PRODUCT_VALIDATORS = Symbol('PRODUCT_VALIDATORS');

export interface ProductValidator {
  readonly productType: string;
  readonly detailKey: string;
  validateCreate(dto: CreateProductDto): void;
  validateUpdate(dto: UpdateProductDto, existing: Product): void;
}
