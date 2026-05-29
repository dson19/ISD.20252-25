import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PaymentService, VietqrPaymentResponse } from '../../../services/payment.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './payment.component.html'
})
export class PaymentComponent implements OnInit, OnDestroy {
  orderId: number | null = null;
  totalAmount = 0;
  paymentMethod: 'QR' | 'CARD' = 'QR';
  qrTimeLeft = '09:59';
  vietqrPayment: VietqrPaymentResponse | null = null;
  loadingQr = false;
  paying = false;
  errorMessage = '';
  
  // Card form details
  cardNumber = '';
  cardExpiry = '';
  cardCvv = '';
  cardName = '';

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paymentService: PaymentService,
  ) {}

  ngOnInit(): void {
    const orderId = Number(this.route.snapshot.queryParamMap.get('orderId'));
    const amount = Number(this.route.snapshot.queryParamMap.get('amount'));

    if (!Number.isFinite(orderId) || !Number.isFinite(amount) || orderId <= 0 || amount <= 0) {
      this.router.navigate(['/checkout']);
      return;
    }

    this.orderId = orderId;
    this.totalAmount = amount;
    this.createQrPayment();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  selectMethod(method: 'QR' | 'CARD') {
    this.paymentMethod = method;
    this.errorMessage = '';
  }

  checkQrStatus(): void {
    if (!this.vietqrPayment) {
      return;
    }

    this.errorMessage = '';
    this.subscriptions.add(
      this.paymentService.getVietqrStatus(this.vietqrPayment.paymentId).subscribe({
        next: (payment) => {
          this.vietqrPayment = payment;
          if (payment.status === 'PAID') {
            this.goToSuccess(payment.transactionRef ?? `VQR-${payment.paymentId}`);
          } else if (payment.status === 'EXPIRED' || payment.status === 'FAILED') {
            this.errorMessage = 'Thanh toán QR đã hết hạn hoặc thất bại. Vui lòng tạo lại đơn hàng.';
          } else {
            this.errorMessage = 'Chưa nhận được thanh toán. Vui lòng thử kiểm tra lại sau.';
          }
        },
        error: () => {
          this.errorMessage = 'Không thể kiểm tra trạng thái thanh toán VietQR.';
        },
      }),
    );
  }

  confirmPayment(): void {
    if (!this.orderId) {
      return;
    }

    if (this.paymentMethod === 'QR') {
      this.checkQrStatus();
      return;
    }

    this.paying = true;
    this.errorMessage = '';
    this.subscriptions.add(
      this.paymentService.createPaypalOrder(this.orderId).subscribe({
        next: (paypalOrder) => {
          this.paying = false;
          if (paypalOrder.approveUrl) {
            window.location.href = paypalOrder.approveUrl;
            return;
          }

          this.errorMessage = 'PayPal chưa trả về đường dẫn phê duyệt thanh toán.';
        },
        error: () => {
          this.paying = false;
          this.errorMessage = 'Không thể tạo thanh toán PayPal. Vui lòng thử lại.';
        },
      }),
    );
  }

  private createQrPayment(): void {
    if (!this.orderId || this.totalAmount <= 0) {
      return;
    }

    this.loadingQr = true;
    this.errorMessage = '';
    this.subscriptions.add(
      this.paymentService.createVietqrPayment(this.orderId, this.totalAmount).subscribe({
        next: (payment) => {
          this.vietqrPayment = payment;
          this.loadingQr = false;
          this.updateQrTimeLeft(payment.expiredAt);
        },
        error: () => {
          this.loadingQr = false;
          this.errorMessage = 'Không thể tạo mã VietQR cho đơn hàng này.';
        },
      }),
    );
  }

  private updateQrTimeLeft(expiredAt: string): void {
    const millisecondsLeft = new Date(expiredAt).getTime() - Date.now();
    const totalSeconds = Math.max(0, Math.floor(millisecondsLeft / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.qrTimeLeft = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private goToSuccess(transactionId: string): void {
    this.router.navigate(['/order-success'], {
      queryParams: {
        orderId: this.orderId,
        amount: this.totalAmount,
        transactionId,
      },
    });
  }
}
