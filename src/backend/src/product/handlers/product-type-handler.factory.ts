import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PRODUCT_TYPE_HANDLERS, ProductTypeHandler } from '../interfaces/product-type-handler.interface';

@Injectable()
export class ProductTypeHandlerFactory {
  private readonly handlers: Map<string, ProductTypeHandler>;
  private readonly detailKeys: Map<string, string>;

  constructor(
    @Inject(PRODUCT_TYPE_HANDLERS) handlers: ProductTypeHandler[],
  ) {
    this.handlers = new Map(handlers.map(h => [h.mediaType.toUpperCase(), h]));
    this.detailKeys = new Map(handlers.map(h => [h.mediaType.toUpperCase(), h.detailKey]));
  }

  getHandler(mediaType: string): ProductTypeHandler {
    const handler = this.handlers.get(mediaType?.toUpperCase());
    if (!handler) {
      throw new BadRequestException(`Unsupported productType: ${mediaType}`);
    }
    return handler;
  }

  getDetailKey(mediaType: string): string {
    return this.getHandler(mediaType).detailKey;
  }

  async findDetail(productId: number, mediaType: string, dataSource: DataSource): Promise<any> {
    return this.getHandler(mediaType).findDetail(productId, dataSource);
  }

  async saveDetail(
    productId: number,
    mediaType: string,
    dto: CreateProductDto | UpdateProductDto,
    manager: EntityManager,
  ): Promise<void> {
    return this.getHandler(mediaType).saveDetail(productId, dto, manager);
  }
}