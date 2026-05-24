import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn, OneToMany } from 'typeorm';
import { Product } from './product.entity';
import { CdTrack } from './cd-track.entity';

@Entity('cds')
export class Cd {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Product, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'text' })
  artists: string;

  @Column({ name: 'record_label', type: 'varchar', length: 255 })
  recordLabel: string;

  @Column({ type: 'varchar', length: 100 })
  genre: string;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: Date;

  @OneToMany(() => CdTrack, (track) => track.cd, { cascade: true })
  tracks: CdTrack[];
}