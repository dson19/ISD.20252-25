import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Cd } from './cd.entity';

@Entity('cd_tracks')
export class CdTrack {
  @PrimaryGeneratedColumn({ name: 'track_id' })
  id: number;

  @ManyToOne(() => Cd, (cd) => cd.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' }) // Chỉ thẳng vào khóa ngoại của bảng cd con
  cd: Cd;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'length_seconds', type: 'int' })
  lengthSeconds: number;
}