import { OrderItem } from './order-item.entity';
import { Order } from './order.entity';

describe('Order.calculateTotalAmount', () => {
  it('O_TC03 returns item total plus shipping fee', () => {
    const order = new Order({
      items: [
        new OrderItem({
          productId: 'book-001',
          quantity: 2,
          unitPrice: 100000,
        }),
        new OrderItem({
          productId: 'dvd-001',
          quantity: 1,
          unitPrice: 300000,
        }),
      ],
      shippingFee: 45000,
    });

    expect(order.calculateTotalAmount()).toBe(545000);
  });
});
