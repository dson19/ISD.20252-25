import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { PaymentService } from '../../../services/payment.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './payment.component.html'
})
export class PaymentComponent implements OnInit {
  totalAmount = signal<number>(0);
  paymentMethod = signal<'QR' | 'CARD'>('QR');
  qrTimeLeft = signal<string>('09:59');
  orderId = signal<number | null>(null);

  loading = signal<boolean>(false);
  statusMessage = signal<string>('');
  orderLoaded = signal<boolean>(false);

  // Custom Alert properties
  isAlertModalOpen = false;
  alertTitle = '';
  alertMessage = '';
  alertType: 'success' | 'error' | 'warning' | 'info' = 'info';

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly paymentService: PaymentService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const orderIdParam = params['orderId'];
      const paypalToken = params['token'];
      const success = params['success'];
      const cancel = params['cancel'];

      if (orderIdParam) {
        this.orderId.set(Number(orderIdParam));

        this.paymentService.getOrderDetail(this.orderId()!).subscribe({
          next: (order) => {
            this.totalAmount.set(Number(order.totalPayment));
            this.orderLoaded.set(true);
          },
          error: (err) => {
            this.orderLoaded.set(true);
            console.error('Lỗi khi lấy thông tin đơn hàng:', err);
          }
        });
      } else {
        this.orderLoaded.set(true);
      }

      if (cancel === 'true' && this.orderId()) {
        this.router.navigate(['/payment-result'], {
          queryParams: {
            success: 'false',
            orderId: this.orderId(),
            error: 'Người dùng đã hủy giao dịch trên PayPal.'
          }
        });
        return;
      }

      // Trường hợp nhận callback từ PayPal chuyển hướng về
      if (paypalToken && success === 'true' && this.orderId()) {
        this.loading.set(true);
        this.statusMessage.set('Đang xác thực giao dịch PayPal, vui lòng không đóng trình duyệt...');

        this.paymentService.captureOrder(paypalToken, this.orderId()!).subscribe({
          next: () => {
            // Xóa sạch giỏ hàng trong localStorage
            localStorage.removeItem('aims_cart');
            this.loading.set(false);
            this.router.navigate(['/payment-result'], {
              queryParams: { success: 'true', orderId: this.orderId() }
            });
          },
          error: (err) => {
            this.loading.set(false);
            this.router.navigate(['/payment-result'], {
              queryParams: {
                success: 'false',
                orderId: this.orderId(),
                error: err.error?.message || err.message || 'Xác thực thanh toán PayPal thất bại.'
              }
            });
          }
        });
      }
    });
  }

  selectMethod(method: 'QR' | 'CARD') {
    this.paymentMethod.set(method);
  }

  confirmPayment() {
    const currentOrderId = this.orderId();
    if (!currentOrderId) {
      this.showAlert('Lỗi đơn hàng', 'Không tìm thấy ID đơn hàng hợp lệ!', 'error');
      return;
    }

    if (this.paymentMethod() === 'QR') {
      this.router.navigate(['/payment-result'], {
        queryParams: { success: 'true', orderId: currentOrderId }
      });
    } else {
      this.loading.set(true);
      this.statusMessage.set('Đang chuẩn bị giao dịch PayPal...');

      this.paymentService.createOrder(currentOrderId).subscribe({
        next: (res) => {
          if (res.approveUrl) {
            window.location.href = res.approveUrl;
          } else {
            this.loading.set(false);
            this.showAlert('Lỗi PayPal', 'Không nhận được link thanh toán từ PayPal.', 'error');
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.showAlert(
            'Lỗi kết nối',
            err.error?.message || 'Lỗi khi kết nối với cổng thanh toán PayPal.',
            'error'
          );
        }
      });
    }
  }

  // Helper Methods for Custom Alert
  showAlert(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    this.alertTitle = title;
    this.alertMessage = message;
    this.alertType = type;
    this.isAlertModalOpen = true;
    this.cdr.detectChanges();
  }

  closeAlert() {
    this.isAlertModalOpen = false;
    this.cdr.detectChanges();
  }
}

