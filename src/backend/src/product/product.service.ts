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
import { Media } from './entities/media.entity';
import { ProductLog } from './entities/product-audit-log.entity';
import { Product } from './entities/product.entity';
import { ProductRepository } from './product.repository';
import { ProductValidatorFactory } from './validators/product-validator.factory';

type DeleteResultStatus = 'DEACTIVATED' | 'DELETED' | 'NOT_FOUND' | 'DEACTIVATED_ORDERED';

const COMMON_PRODUCT_FIELDS: (keyof CreateProductDto)[] = [
  'productType',
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
    mediaTypes?: string[];
    minPrice?: number;
    maxPrice?: number;
    status?: string;
  }): Promise<Product[]> {
    return this.productRepository.searchProducts(
      params.keyword,
      params.category,
      params.minPrice,
      params.maxPrice,
      params.mediaTypes,
      params.status,
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
        validator.productType,
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
      delete productPatch.productType;
      productRepo.merge(product, productPatch);
      const savedProduct = await productRepo.save(product);

      await this.saveProductDetail(
        manager,
        savedProduct,
        validator.productType,
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
          // Kiểm tra xem sản phẩm đã từng được đặt mua (nằm trong order_items) chưa trước khi xóa
          const countRes = await manager.query(
            'SELECT COUNT(*) as count FROM order_items WHERE product_id = $1',
            [id],
          );
          const hasOrder = Number(countRes[0]?.count) > 0;

          if (hasOrder) {
            // Nếu đã có đơn hàng, không xóa cứng mà tự động chuyển sang NGỪNG HOẠT ĐỘNG để bảo toàn dữ liệu lịch sử đặt hàng
            await productRepo.update(id, { status: 'DEACTIVATED' });
            await this.writeAuditLog(manager, {
              product,
              actionType: 'DEACTIVATE',
              changedFields: {
                productID: id,
                quantityInStock: product.quantityInStock,
                status: 'DEACTIVATED_ORDERED',
              },
              performedBy: managerId,
            });
            output.push({ id, status: 'DEACTIVATED_ORDERED' });
          } else {
            // Nếu chưa có đơn hàng nào, tiến hành xóa mềm bằng cách cập nhật trạng thái thành DELETED
            await this.writeAuditLog(manager, {
              product,
              actionType: 'DELETE',
              changedFields: {
                productID: id,
                title: product.title,
                productType: product.productType,
              },
              performedBy: managerId,
            });
            await productRepo.update(id, { status: 'DELETED' });
            output.push({ id, status: 'DELETED' });
          }
        }
      }

      return output;
    });

    return { results };
  }

  async deactivateProducts(dto: BatchDeleteProductsDto, managerId: string) {
    const uniqueIds = [...new Set(dto.ids)];
    if (uniqueIds.length !== dto.ids.length) {
      throw new BadRequestException('ids must be unique');
    }

    if (uniqueIds.length > 10) {
      throw new BadRequestException('Cannot deactivate more than 10 products once');
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
    const productType = product.productType;
    const detailKey = this.detailKeyForMediaType(productType);
    const detail = await this.findDetail(product.productID, productType);

    return {
      ...product,
      [detailKey]: this.stripAndFlattenDetail(detail),
    };
  }

  private async findDetail(productID: number, productType: string) {
    switch (productType?.toUpperCase()) {
      case 'BOOK':
        return this.dataSource
          .getRepository(Book)
          .findOne({ where: { productID }, relations: ['media'] });
      case 'CD':
        return this.dataSource.getRepository(Cd).findOne({
          where: { productID },
          relations: ['media', 'tracks'],
        });
      case 'DVD':
        return this.dataSource.getRepository(Dvd).findOne({
          where: { productID },
          relations: ['media'],
        });
      case 'NEWSPAPER':
        return this.dataSource
          .getRepository(Newspaper)
          .findOne({ where: { productID }, relations: ['media'] });
      default:
        throw new BadRequestException(`Unsupported productType: ${productType}`);
    }
  }

  private async saveProductDetail(
    manager: EntityManager,
    product: Product,
    productType: string,
    dto: CreateProductDto | UpdateProductDto,
  ): Promise<void> {
    const mediaRepo = manager.getRepository(Media);
    let publisher: string | undefined;
    let releaseDate: Date | string | undefined;
    let language: string | undefined;
    let genre: string | undefined;

    if (dto.book) {
      publisher = dto.book.publisher;
      releaseDate = dto.book.publicationDate;
      language = dto.book.language;
      genre = dto.book.genre;
    } else if (dto.newspaper) {
      publisher = dto.newspaper.publisher;
      releaseDate = dto.newspaper.publicationDate;
      language = dto.newspaper.language;
    } else if (dto.cd) {
      publisher = dto.cd.recordLabel;
      releaseDate = dto.cd.releaseDate;
      genre = dto.cd.genre;
    } else if (dto.dvd) {
      publisher = dto.dvd.studio;
      releaseDate = dto.dvd.releaseDate;
      language = dto.dvd.language;
      genre = dto.dvd.genre;
    }

    const savedMedia = await mediaRepo.save({
      productID: product.productID,
      product,
      publisher,
      releaseDate: releaseDate ? new Date(releaseDate) : undefined,
      language,
      genre,
    });

    switch (productType?.toUpperCase()) {
      case 'BOOK':
        if (dto.book) {
          await manager.getRepository(Book).save({
            productID: product.productID,
            media: savedMedia,
            authors: dto.book.authors,
            coverType: dto.book.coverType,
            numPages: dto.book.numPages,
          });
        }
        return;
      case 'CD':
        if (dto.cd) {
          const { tracks, ...cdFields } = dto.cd;
          const cd = await manager.getRepository(Cd).save({
            productID: product.productID,
            media: savedMedia,
            artists: cdFields.artists,
          });

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
          await manager.getRepository(Dvd).save({
            productID: product.productID,
            media: savedMedia,
            discType: dto.dvd.discType,
            director: dto.dvd.director,
            runtimeMinutes: dto.dvd.runtimeMinutes,
            subtitles: dto.dvd.subtitles,
          });
        }
        return;
      case 'NEWSPAPER':
        if (dto.newspaper) {
          await manager.getRepository(Newspaper).save({
            productID: product.productID,
            media: savedMedia,
            editorInChief: dto.newspaper.editorInChief,
            issueNumber: dto.newspaper.issueNumber,
            frequency: dto.newspaper.frequency,
            issn: dto.newspaper.issn,
            sections: dto.newspaper.sections,
          });
        }
        return;
      default:
        throw new BadRequestException(`Unsupported productType: ${productType}`);
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

  private stripAndFlattenDetail(detail: any): any {
    if (!detail) {
      return null;
    }
    const { media, ...rest } = detail;
    if (media) {
      const { product, ...mediaFields } = media;
      const result = {
        ...rest,
        ...mediaFields,
      };
      if (mediaFields.releaseDate !== undefined) {
        result.publicationDate = mediaFields.releaseDate;
      }
      if (mediaFields.publisher !== undefined) {
        result.recordLabel = mediaFields.publisher;
      }
      if (mediaFields.publisher !== undefined) {
        result.studio = mediaFields.publisher;
      }
      return result;
    }
    const { product, ...payload } = detail;
    return payload;
  }

  private detailKeyForMediaType(productType: string): string {
    switch (productType?.toUpperCase()) {
      case 'BOOK':
        return 'book';
      case 'CD':
        return 'cd';
      case 'DVD':
        return 'dvd';
      case 'NEWSPAPER':
        return 'newspaper';
      default:
        throw new BadRequestException(`Unsupported productType: ${productType}`);
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
