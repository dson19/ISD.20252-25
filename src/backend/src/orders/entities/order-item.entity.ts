import { InvalidPriceException } from '../exceptions/invalid-price.exception';
import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';

type OrderItemProps = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export class OrderItem {
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: number;

  constructor(props: OrderItemProps) {
    this.productId = props.productId;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
  }

  calculateSubTotal(): number {
    if (this.quantity <= 0) {
      throw new InvalidQuantityException(this.quantity);
    }

    if (this.unitPrice <= 0) {
      throw new InvalidPriceException('Unit price must be greater than zero');
    }

    return this.quantity * this.unitPrice;
  }
}
