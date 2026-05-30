import { Injectable } from '@nestjs/common';
import { Between, Brackets, DataSource, In, Repository } from 'typeorm';
import { ProductLog } from './entities/product-audit-log.entity';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductRepository {
  private repository: Repository<Product>;
  private auditLogRepository: Repository<ProductLog>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Product);
    this.auditLogRepository = this.dataSource.getRepository(ProductLog);
  }

  async findById(id: number): Promise<Product | null> {
    return this.repository.findOneBy({ productID: id });
  }

  async getAvailableStock(id: number): Promise<number> {
    const product = await this.findById(id);
    return product ? product.quantityInStock : 0;
  }

  async findProductsByIds(ids: number[]): Promise<Product[]> {
    if (!ids.length) {
      return [];
    }

    return this.repository.findBy({ productID: In(ids) });
  }

  async searchProducts(
    keyword?: string,
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    mediaTypes?: string[],
  ): Promise<Product[]> {
    const query = this.repository.createQueryBuilder('product');
    query.where('product.status = :status', { status: 'ACTIVE' });

    const normalizedKeyword = keyword?.trim();
    if (normalizedKeyword) {
      query
        .leftJoin('books', 'book', 'book.product_id = product.product_id')
        .leftJoin('cds', 'cd', 'cd.product_id = product.product_id')
        .leftJoin('cd_tracks', 'track', 'track.product_id = product.product_id')
        .leftJoin('dvds', 'dvd', 'dvd.product_id = product.product_id')
        .leftJoin('newspapers', 'newspaper', 'newspaper.product_id = product.product_id')
        .distinct(true)
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.title ILIKE :keyword')
              .orWhere('product.category ILIKE :keyword')
              .orWhere('product.description ILIKE :keyword')
              .orWhere('product.barcode ILIKE :keyword')
              .orWhere('book.authors ILIKE :keyword')
              .orWhere('book.publisher ILIKE :keyword')
              .orWhere('book.genre ILIKE :keyword')
              .orWhere('cd.artists ILIKE :keyword')
              .orWhere('cd.record_label ILIKE :keyword')
              .orWhere('cd.genre ILIKE :keyword')
              .orWhere('track.title ILIKE :keyword')
              .orWhere('dvd.director ILIKE :keyword')
              .orWhere('dvd.studio ILIKE :keyword')
              .orWhere('dvd.genre ILIKE :keyword')
              .orWhere('newspaper.publisher ILIKE :keyword')
              .orWhere('newspaper.editor_in_chief ILIKE :keyword')
              .orWhere('newspaper.sections ILIKE :keyword');
          }),
          { keyword: `%${normalizedKeyword}%` },
        );
    }
    if (category) {
      const categoryAliases = this.getCategoryAliases(category);
      const mediaType = this.getMediaTypeForCategory(category);

      query.andWhere(
        new Brackets((qb) => {
          qb.where('product.category IN (:...categoryAliases)', {
            categoryAliases,
          });

          if (mediaType) {
            qb.orWhere('product.product_type = :mediaType', { mediaType });
          }
        }),
      );
    }
    if (mediaTypes?.length) {
      query.andWhere('product.product_type IN (:...mediaTypes)', {
        mediaTypes,
      });
    }
    if (minPrice !== undefined) {
      query.andWhere('product.current_price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      query.andWhere('product.current_price <= :maxPrice', { maxPrice });
    }

    return query.orderBy('product.title', 'ASC').getMany();
  }

  async findRandomActive(limit: number): Promise<Product[]> {
    return this.repository
      .createQueryBuilder('product')
      .where('product.status = :status', { status: 'ACTIVE' })
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  private getCategoryAliases(category: string): string[] {
    const normalized = category.trim();
    const upper = normalized.toUpperCase();
    const aliasMap: Record<string, string[]> = {
      'SÁCH': ['SÁCH', 'SACH', 'BOOK', 'Book', 'book'],
      SACH: ['SÁCH', 'SACH', 'BOOK', 'Book', 'book'],
      BOOK: ['SÁCH', 'SACH', 'BOOK', 'Book', 'book'],
      CD: ['CD', 'cd'],
      DVD: ['DVD', 'dvd'],
      'BÁO': ['BÁO', 'BÁO CHÍ', 'BAO', 'BAO CHI', 'NEWSPAPER', 'Newspaper', 'newspaper'],
      'BÁO CHÍ': ['BÁO', 'BÁO CHÍ', 'BAO', 'BAO CHI', 'NEWSPAPER', 'Newspaper', 'newspaper'],
      BAO: ['BÁO', 'BÁO CHÍ', 'BAO', 'BAO CHI', 'NEWSPAPER', 'Newspaper', 'newspaper'],
      'BAO CHI': ['BÁO', 'BÁO CHÍ', 'BAO', 'BAO CHI', 'NEWSPAPER', 'Newspaper', 'newspaper'],
      NEWSPAPER: ['BÁO', 'BÁO CHÍ', 'BAO', 'BAO CHI', 'NEWSPAPER', 'Newspaper', 'newspaper'],
    };

    return Array.from(new Set([normalized, upper, ...(aliasMap[upper] ?? [])]));
  }

  private getMediaTypeForCategory(category: string): string | undefined {
    const upper = category.trim().toUpperCase();
    const mediaTypeMap: Record<string, string> = {
      'SÁCH': 'BOOK',
      SACH: 'BOOK',
      BOOK: 'BOOK',
      CD: 'CD',
      DVD: 'DVD',
      'BÁO': 'NEWSPAPER',
      'BÁO CHÍ': 'NEWSPAPER',
      BAO: 'NEWSPAPER',
      'BAO CHI': 'NEWSPAPER',
      NEWSPAPER: 'NEWSPAPER',
    };

    return mediaTypeMap[upper];
  }

  async countManagerDeleteActions(
    managerId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    return this.auditLogRepository.count({
      where: {
        performedBy: managerId,
        actionType: In(['DELETE', 'DEACTIVATE']),
        createdAt: Between(start, new Date(end.getTime() - 1)),
      },
    });
  }

  async findAuditLogs(): Promise<ProductLog[]> {
    return this.auditLogRepository.find({
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }
}
