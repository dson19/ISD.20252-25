import { OrderItem } from './order-item.entity';

type OrderProps = {
  items: OrderItem[];
  shippingFee: number;
  status?: OrderStatus;
};

export enum OrderStatus {
  Draft = 'DRAFT',
  Pending = 'PENDING',
  Paid = 'PAID',
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

  calculateTotalAmount(): number {
    const itemsTotal = this.items.reduce(
      (total, item) => total + item.calculateSubTotal(),
      0,
    );

    return itemsTotal + this.shippingFee;
  }
}
