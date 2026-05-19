import { Product } from './domain/product.entity';

export const PRODUCT_REPOSITORY = 'PRODUCT_REPOSITORY';

export interface ProductRepository {
  findOne(productID: number): Promise<Product | null>;
}
