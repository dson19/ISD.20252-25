import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Check } from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../product/entities/product.entity'; 

@Entity('order_items')
@Check(`quantity > 0`)
@Check(`unit_price >= 0`)
export class OrderItem {
  @PrimaryGeneratedColumn({ name: 'order_item_id' })
  orderItemID: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number; 

  @ManyToOne(() => Order, (order) => order.orderItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Product, { eager: true }) 
  @JoinColumn({ name: 'product_id' })
  product: Product;
}