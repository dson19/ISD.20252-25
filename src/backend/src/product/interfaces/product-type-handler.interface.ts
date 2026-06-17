import { EntityManager } from 'typeorm';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

export const PRODUCT_TYPE_HANDLERS = 'PRODUCT_TYPE_HANDLERS';

export interface ProductTypeHandler {
  readonly mediaType: string;
  readonly detailKey: string;
  findDetail(productId: number, dataSource: any): Promise<any>;
  saveDetail(productId: number, dto: CreateProductDto | UpdateProductDto, manager: EntityManager): Promise<void>;
}
