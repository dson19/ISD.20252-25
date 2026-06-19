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

  paymentMethod = signal<string | null>(null);

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
      this.errorMessage.set(errorParam || 'Transaction failed or was cancelled.');

      if (orderIdParam) {
        const id = Number(orderIdParam);
        this.orderId.set(id);

        this.paymentService.getOrderDetail(id).subscribe({
          next: (order) => {
            this.totalAmount.set(Number(order.totalPayment));
            this.deliveryInfo.set(order.deliveryInfo);
            this.paymentMethod.set(order.paymentMethod);
            this.orderLoaded.set(true);
          },
          error: (err) => {
            console.error('Error fetching order details:', err);
            this.orderLoaded.set(true);
          }
        });
      } else {
        this.orderLoaded.set(true);
      }
    });
  }
}
