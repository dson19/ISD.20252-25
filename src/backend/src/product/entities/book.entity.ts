import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Media } from './media.entity';

@Entity('books')
export class Book {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Media, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  media: Media;

  @Column({ type: 'text' })
  authors: string;

  @Column({ name: 'cover_type', type: 'varchar', length: 50 })
  coverType: string; // PAPERBACK, HARDCOVER

  @Column({ name: 'num_pages', type: 'int', nullable: true })
  numPages: number;
}