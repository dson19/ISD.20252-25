import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('media')
export class Media {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Product, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publisher: string;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  genre: string;
}
