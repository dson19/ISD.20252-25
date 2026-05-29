import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { PaymentService } from '../../../services/payment.service';

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment-result.component.html'
})
export class PaymentResultComponent implements OnInit {
  isSuccess = signal<boolean>(true);
  orderId = signal<number | null>(null);
  totalAmount = signal<number>(0);
  deliveryInfo = signal<any>(null);
  errorMessage = signal<string>('');
  orderLoaded = signal<boolean>(false);

  constructor(
    private route: ActivatedRoute,
    private paymentService: PaymentService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const successParam = params['success'];
      const orderIdParam = params['orderId'];
      const errorParam = params['error'];

      this.isSuccess.set(successParam === 'true');
      this.errorMessage.set(errorParam || 'Giao dịch không thành công hoặc đã bị hủy.');

      if (orderIdParam) {
        const id = Number(orderIdParam);
        this.orderId.set(id);

        this.paymentService.getOrderDetail(id).subscribe({
          next: (order) => {
            this.totalAmount.set(Number(order.totalPayment));
            this.deliveryInfo.set(order.deliveryInfo);
            this.orderLoaded.set(true);
          },
          error: (err) => {
            console.error('Lỗi khi lấy thông tin đơn hàng:', err);
            this.orderLoaded.set(true);
          }
        });
      } else {
        this.orderLoaded.set(true);
      }
    });
  }
}
