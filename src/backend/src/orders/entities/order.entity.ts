import { OrderItem } from './order-item.entity';

type OrderProps = {
  items: OrderItem[];
  shippingFee: number;
  status?: OrderStatus;
};

export enum OrderStatus {
  Draft = 'DRAFT',
  Pending = 'PENDING',
}

export class Order {
  readonly items: OrderItem[];
  readonly shippingFee: number;
  status: OrderStatus;

  constructor(props: OrderProps) {
    this.items = props.items;
    this.shippingFee = props.shippingFee;
    this.status = props.status ?? OrderStatus.Draft;
  }
}
