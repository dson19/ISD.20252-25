import { Product } from './domain/product.entity';

export const PRODUCT_REPOSITORY = 'PRODUCT_REPOSITORY';

export interface ProductRepository {
  findOne(productID: number): Promise<Product | null>;
  findByBarcode(barcode: string): Promise<Product | null>;
  create(dto: any): Product;
  save(product: Product): Promise<Product>;
  checkInOrders(productID: number): Promise<boolean>;
  delete(productID: number): Promise<void>;
  getDailyDeletionCount(): Promise<number>;
}
