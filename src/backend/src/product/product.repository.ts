import { Injectable } from '@nestjs/common';
import { Between, DataSource, In, Repository } from 'typeorm';
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
  ): Promise<Product[]> {
    const query = this.repository.createQueryBuilder('product');
    query.where('product.status = :status', { status: 'ACTIVE' });

    if (keyword) {
      query.andWhere('product.title ILIKE :keyword', {
        keyword: `%${keyword}%`,
      });
    }
    if (category) {
      query.andWhere('product.category = :category', { category });
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
