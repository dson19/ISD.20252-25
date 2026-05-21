import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('books')
export class Book {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Product, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'text' })
  authors: string;

  @Column({ name: 'cover_type', type: 'varchar', length: 50 })
  coverType: string; // PAPERBACK, HARDCOVER

  @Column({ type: 'varchar', length: 255 })
  publisher: string;

  @Column({ name: 'publication_date', type: 'date' })
  publicationDate: Date;

  @Column({ name: 'num_pages', type: 'int', nullable: true })
  numPages: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  genre: string;
}