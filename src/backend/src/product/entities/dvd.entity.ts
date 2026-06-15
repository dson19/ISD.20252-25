import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Media } from './media.entity';

@Entity('dvds')
export class Dvd {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Media, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  media: Media;

  @Column({ name: 'disc_type', type: 'varchar', length: 50 })
  discType: string; // Blu-ray, HD-DVD

  @Column({ type: 'varchar', length: 255 })
  director: string;

  @Column({ name: 'runtime_minutes', type: 'int' })
  runtimeMinutes: number;

  @Column({ type: 'text' })
  subtitles: string;
}