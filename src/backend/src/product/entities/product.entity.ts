import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Check 
} from 'typeorm';

@Entity('products')
@Check(`current_price >= 0.3 * original_value AND current_price <= 1.5 * original_value`) // Luật chống phá giá/lạm phát
@Check(`quantity_in_stock >= 0`) // Số lượng tồn kho không được âm
export class Product {
  @PrimaryGeneratedColumn({ name: 'product_id' })
  productID: number;

  @Column({ type: 'varchar', length: 20, name: 'product_type' })
  mediaType: string; // BOOK, NEWSPAPER, CD, DVD

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 45 })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  barcode: string;

  @Column({ type: 'double precision', nullable: true })
  length: number;

  @Column({ type: 'double precision', nullable: true })
  width: number;

  @Column({ type: 'double precision', nullable: true })
  height: number;

  @Column({ type: 'double precision' })
  weight: number;

  @Column({ name: 'original_value', type: 'decimal', precision: 12, scale: 2 })
  originalPrice: number;

  @Column({ name: 'current_price', type: 'decimal', precision: 12, scale: 2 })
  currentPrice: number;

  @Column({ name: 'quantity_in_stock', type: 'int', default: 0 })
  quantityInStock: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string; // ACTIVE, DEACTIVATED

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}