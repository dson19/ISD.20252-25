import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductRepository {
  private repository: Repository<Product>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Product);
  }

  async findById(id: number): Promise<Product | null> {
    return this.repository.findOneBy({ productID: id });
  }

  async getAvailableStock(id: number): Promise<number> {
    const product = await this.findById(id);
    return product ? product.quantityInStock : 0;
  }

  async searchProducts(keyword: string, category?: string): Promise<Product[]> {
    const query = this.repository.createQueryBuilder('product');
    
    if (keyword) {
      query.andWhere('product.title ILIKE :keyword', { keyword: `%${keyword}%` });
    }
    if (category) {
      query.andWhere('product.category = :category', { category });
    }

    return query.getMany();
  }
}