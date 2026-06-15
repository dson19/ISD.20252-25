import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn, OneToMany } from 'typeorm';
import { Media } from './media.entity';
import { CdTrack } from './cd-track.entity';

@Entity('cds')
export class Cd {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Media, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  media: Media;

  @Column({ type: 'text' })
  artists: string;

  @OneToMany(() => CdTrack, (track) => track.cd, { cascade: true })
  tracks: CdTrack[];
}