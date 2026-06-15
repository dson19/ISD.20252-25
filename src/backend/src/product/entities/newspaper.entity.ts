import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Media } from './media.entity';

@Entity('newspapers')
export class Newspaper {
  @PrimaryColumn({ name: 'product_id' })
  productID: number;

  @OneToOne(() => Media, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  media: Media;

  @Column({ name: 'editor_in_chief', type: 'varchar', length: 255 })
  editorInChief: string;

  @Column({ name: 'issue_number', type: 'varchar', length: 50, nullable: true })
  issueNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  frequency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  issn: string;

  @Column({ type: 'text', nullable: true })
  sections: string;
}