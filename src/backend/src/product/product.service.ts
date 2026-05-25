import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BatchDeleteProductsDto } from './dto/batch-delete-products.dto';
import { ChangeStockDto } from './dto/change-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Book } from './entities/book.entity';
import { CdTrack } from './entities/cd-track.entity';
import { Cd } from './entities/cd.entity';
import { Dvd } from './entities/dvd.entity';
import { Newspaper } from './entities/newspaper.entity';
import { ProductLog } from './entities/product-audit-log.entity';
import { Product } from './entities/product.entity';
import { ProductRepository } from './product.repository';
import {
  ProductMediaType,
  ProductValidatorFactory,
} from './validators/product-validator.factory';

type ProductDetailKey = 'book' | 'cd' | 'dvd' | 'newspaper';
type DeleteResultStatus = 'DEACTIVATED' | 'DELETED' | 'NOT_FOUND';

const COMMON_PRODUCT_FIELDS: (keyof CreateProductDto)[] = [
  'mediaType',
  'title',
  'category',
  'description',
  'barcode',
  'length',
  'width',
  'height',
  'weight',
  'originalPrice',
  'currentPrice',
  'quantityInStock',
  'status',
  'imageUrl',
];

/**
 * + Coupling/Cohesion level:
 *   - Control Coupling: ProductService passes the `mediaType` string to ProductValidatorFactory to retrieve validator strategies.
 *   - Data Coupling: Interacts with ProductRepository by passing primitive search parameters and IDs.
 *   - Procedural Cohesion: Sequences database transactions, entity creations, audit log writing, and attachment logic.
 * + Reason why:
 *   - Outsourcing specific validations to ProductValidatorFactory keeps core catalog operations stateless and free of hardcoded conditional switches.
 */
@Injectable()
export class ProductService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly productRepository: ProductRepository,
    private readonly validatorFactory: ProductValidatorFactory,
  ) {}

  async searchProducts(params: {
    keyword?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<Product[]> {
    return this.productRepository.searchProducts(
      params.keyword,
      params.category,
      params.minPrice,
      params.maxPrice,
    );
  }

  async getRandomProducts(): Promise<Product[]> {
    return this.productRepository.findRandomActive(20);
  }

  async getProductById(id: number) {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.attachDetail(product);
  }

  async createProduct(dto: CreateProductDto, managerId: string) {
    const validator = this.validatorFactory.validateCreate(dto);

    const product = await this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const savedProduct = await productRepo.save(
        productRepo.create(this.buildProductPayload(dto)),
      );

      await this.saveProductDetail(
        manager,
        savedProduct,
        validator.mediaType,
        dto,
      );
      await this.writeAuditLog(manager, {
        product: savedProduct,
        actionType: 'CREATE',
        changedFields: { after: dto },
        performedBy: managerId,
      });

      return savedProduct;
    });

    return this.getProductById(product.productID);
  }

  async updateProduct(id: number, dto: UpdateProductDto, managerId: string) {
    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const validator = this.validatorFactory.validateUpdate(dto, existing);

    await this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const product = await productRepo.findOneByOrFail({ productID: id });
      const productPatch = this.buildProductPayload(dto);
      delete productPatch.mediaType;
      productRepo.merge(product, productPatch);
      const savedProduct = await productRepo.save(product);

      await this.saveProductDetail(
        manager,
        savedProduct,
        validator.mediaType,
        dto,
      );
      await this.writeAuditLog(manager, {
        product: savedProduct,
        actionType: 'UPDATE',
        changedFields: { before: existing, after: dto },
        performedBy: managerId,
      });
    });

    return this.getProductById(id);
  }

  async deleteProducts(dto: BatchDeleteProductsDto, managerId: string) {
    const uniqueIds = [...new Set(dto.ids)];
    if (uniqueIds.length !== dto.ids.length) {
      throw new BadRequestException('ids must be unique');
    }

    if (uniqueIds.length > 10) {
      throw new BadRequestException('Cannot delete more than 10 products once');
    }

    const existingProducts =
      await this.productRepository.findProductsByIds(uniqueIds);
    const existingCount = existingProducts.length;
    const { start, end } = this.getTodayRange();
    const currentDeleteActions =
      await this.productRepository.countManagerDeleteActions(
        managerId,
        start,
        end,
      );

    if (currentDeleteActions + existingCount > 20) {
      throw new BadRequestException(
        'Manager delete quota exceeded: maximum 20 products per day',
      );
    }

    const results = await this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const productsById = new Map(
        existingProducts.map((product) => [product.productID, product]),
      );
      const output: { id: number; status: DeleteResultStatus }[] = [];

      for (const id of uniqueIds) {
        const product = productsById.get(id);
        if (!product) {
          output.push({ id, status: 'NOT_FOUND' });
          continue;
        }

        if (product.quantityInStock > 0) {
          await productRepo.update(id, { status: 'DEACTIVATED' });
          await this.writeAuditLog(manager, {
            product,
            actionType: 'DEACTIVATE',
            changedFields: {
              productID: id,
              quantityInStock: product.quantityInStock,
              status: 'DEACTIVATED',
            },
            performedBy: managerId,
          });
          output.push({ id, status: 'DEACTIVATED' });
        } else {
          await this.writeAuditLog(manager, {
            product,
            actionType: 'DELETE',
            changedFields: {
              productID: id,
              title: product.title,
              mediaType: product.mediaType,
            },
            performedBy: managerId,
          });
          await productRepo.delete(id);
          output.push({ id, status: 'DELETED' });
        }
      }

      return output;
    });

    return { results };
  }

  async adjustStock(id: number, dto: ChangeStockDto, managerId: string) {
    const updatedProduct = await this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const product = await productRepo.findOne({
        where: { productID: id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      const oldQuantity = product.quantityInStock;
      const newQuantity = oldQuantity + dto.quantityDelta;
      if (newQuantity < 0) {
        throw new BadRequestException('Stock adjustment cannot make stock negative');
      }

      product.quantityInStock = newQuantity;
      const savedProduct = await productRepo.save(product);
      await this.writeAuditLog(manager, {
        product: savedProduct,
        actionType: 'STOCK_ADJUST',
        changedFields: {
          productID: id,
          from: oldQuantity,
          to: newQuantity,
          delta: dto.quantityDelta,
        },
        performedBy: managerId,
        reason: dto.reason,
      });

      return savedProduct;
    });

    return this.getProductById(updatedProduct.productID);
  }

  async getAuditLogs(): Promise<ProductLog[]> {
    return this.productRepository.findAuditLogs();
  }

  private async attachDetail(product: Product) {
    const mediaType = product.mediaType as ProductMediaType;
    const detailKey = this.detailKeyForMediaType(mediaType);
    const detail = await this.findDetail(product.productID, mediaType);

    return {
      ...product,
      [detailKey]: this.stripNestedProduct(detail),
    };
  }

  private async findDetail(productID: number, mediaType: ProductMediaType) {
    switch (mediaType) {
      case 'BOOK':
        return this.dataSource
          .getRepository(Book)
          .findOneBy({ productID });
      case 'CD':
        return this.dataSource.getRepository(Cd).findOne({
          where: { productID },
          relations: ['tracks'],
        });
      case 'DVD':
        return this.dataSource.getRepository(Dvd).findOneBy({ productID });
      case 'NEWSPAPER':
        return this.dataSource
          .getRepository(Newspaper)
          .findOneBy({ productID });
    }
  }

  private async saveProductDetail(
    manager: EntityManager,
    product: Product,
    mediaType: ProductMediaType,
    dto: CreateProductDto | UpdateProductDto,
  ): Promise<void> {
    switch (mediaType) {
      case 'BOOK':
        if (dto.book) {
          await manager
            .getRepository(Book)
            .save({ productID: product.productID, product, ...dto.book });
        }
        return;
      case 'CD':
        if (dto.cd) {
          const { tracks, ...cdFields } = dto.cd;
          const cd = await manager
            .getRepository(Cd)
            .save({ productID: product.productID, product, ...cdFields });

          if (tracks !== undefined) {
            await manager
              .getRepository(CdTrack)
              .createQueryBuilder()
              .delete()
              .where('product_id = :productID', { productID: product.productID })
              .execute();
          }

          if (tracks) {
            await manager.getRepository(CdTrack).save(
              tracks.map((track) => ({
                ...track,
                cd,
              })),
            );
          }
        }
        return;
      case 'DVD':
        if (dto.dvd) {
          await manager
            .getRepository(Dvd)
            .save({ productID: product.productID, product, ...dto.dvd });
        }
        return;
      case 'NEWSPAPER':
        if (dto.newspaper) {
          await manager.getRepository(Newspaper).save({
            productID: product.productID,
            product,
            ...dto.newspaper,
          });
        }
        return;
    }
  }

  private async writeAuditLog(
    manager: EntityManager,
    params: {
      product: Product;
      actionType: string;
      changedFields: unknown;
      performedBy: string;
      reason?: string;
    },
  ): Promise<void> {
    await manager.getRepository(ProductLog).save({
      product: params.product,
      actionType: params.actionType,
      changedFields: params.changedFields,
      performedBy: params.performedBy,
      reason: params.reason,
    });
  }

  private buildProductPayload(dto: CreateProductDto | UpdateProductDto) {
    const payload: Partial<Product> = {};
    for (const field of COMMON_PRODUCT_FIELDS) {
      if (dto[field] !== undefined) {
        payload[field as keyof Product] = dto[field] as never;
      }
    }
    return payload;
  }

  private stripNestedProduct<T>(detail: T): Omit<T, 'product'> | null {
    if (!detail) {
      return null;
    }

    const { product: _product, ...payload } = detail as T & {
      product?: Product;
    };
    return payload;
  }

  private detailKeyForMediaType(mediaType: ProductMediaType): ProductDetailKey {
    switch (mediaType) {
      case 'BOOK':
        return 'book';
      case 'CD':
        return 'cd';
      case 'DVD':
        return 'dvd';
      case 'NEWSPAPER':
        return 'newspaper';
    }
  }

  private getTodayRange(): { start: Date; end: Date } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
}
