import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('dvds')
export class Dvd {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Product, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'disc_type', type: 'varchar', length: 50 })
  discType: string; // Blu-ray, HD-DVD

  @Column({ type: 'varchar', length: 255 })
  director: string;

  @Column({ name: 'runtime_minutes', type: 'int' })
  runtimeMinutes: number;

  @Column({ type: 'varchar', length: 255 })
  studio: string;

  @Column({ type: 'varchar', length: 50 })
  language: string;

  @Column({ type: 'text' })
  subtitles: string;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  genre: string;
}