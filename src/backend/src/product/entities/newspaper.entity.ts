import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('newspapers')
export class Newspaper {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Product, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'editor_in_chief', type: 'varchar', length: 255 })
  editorInChief: string;

  @Column({ type: 'varchar', length: 255 })
  publisher: string;

  @Column({ name: 'publication_date', type: 'date' })
  publicationDate: Date;

  @Column({ name: 'issue_number', type: 'varchar', length: 50, nullable: true })
  issueNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  frequency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  issn: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language: string;

  @Column({ type: 'text', nullable: true })
  sections: string;
}