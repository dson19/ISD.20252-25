import { Component, OnInit, OnDestroy, signal, ChangeDetectorRef } from '@angular/core';
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
export class PaymentComponent implements OnInit, OnDestroy {
  totalAmount = signal<number>(0);
  paymentMethod = signal<'QR' | 'CARD'>('QR');
  qrTimeLeft = signal<string>('09:59');
  orderId = signal<number | null>(null);

  loading = signal<boolean>(false);
  statusMessage = signal<string>('');
  orderLoaded = signal<boolean>(false);

  // VietQR Dynamic Properties
  qrCode = signal<string | null>(null);
  qrLink = signal<string | null>(null);
  bankCode = signal<string>('');
  bankAccount = signal<string>('');
  bankAccountName = signal<string>('');
  paymentContent = signal<string>('');
  paymentId = signal<number | null>(null);
  isExpired = signal<boolean>(false);

  // Custom Alert properties
  isAlertModalOpen = false;
  alertTitle = '';
  alertMessage = '';
  alertType: 'success' | 'error' | 'warning' | 'info' = 'info';

  private timerSubscription: any;
  private pollingSubscription: any;

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

      if (paypalToken || cancel === 'true') {
        this.paymentMethod.set('CARD');
      }

      if (orderIdParam) {
        this.orderId.set(Number(orderIdParam));

        this.paymentService.getOrderDetail(this.orderId()!).subscribe({
          next: (order) => {
            this.totalAmount.set(Number(order.totalPayment));
            this.orderLoaded.set(true);
            if (this.paymentMethod() === 'QR') {
              this.loadOrCreateVietqrPayment();
            }
          },
          error: (err) => {
            this.orderLoaded.set(true);
            console.error('Error fetching order details:', err);
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
            error: 'User cancelled the PayPal transaction.'
          }
        });
        return;
      }

      if (paypalToken && success === 'true' && this.orderId()) {
        this.loading.set(true);
        this.statusMessage.set('Verifying PayPal transaction, please do not close the browser...');

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
                error: err.error?.message || err.message || 'PayPal payment verification failed.'
              }
            });
          }
        });
      }
    });
  }

  ngOnDestroy() {
    this.stopStatusPolling();
    if (this.timerSubscription) {
      clearInterval(this.timerSubscription);
    }
  }

  selectMethod(method: 'QR' | 'CARD') {
    this.paymentMethod.set(method);
    if (method === 'QR') {
      if (this.paymentId() && !this.isExpired()) {
        this.startStatusPolling(this.paymentId()!);
      } else if (!this.paymentId() || this.isExpired()) {
        this.loadOrCreateVietqrPayment();
      }
    } else {
      this.stopStatusPolling();
    }
  }

  loadOrCreateVietqrPayment() {
    const orderId = this.orderId();
    const amount = this.totalAmount();
    if (!orderId || amount <= 0) {
      return;
    }

    // If we already have a loaded valid paymentId, don't recreate it
    if (this.paymentId() && !this.isExpired()) {
      this.startStatusPolling(this.paymentId()!);
      return;
    }

    this.loading.set(true);
    this.statusMessage.set('Creating VietQR payment code...');
    
    const content = `AIMS ${orderId}`;

    this.paymentService.createVietqrPayment(orderId, amount, content).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.paymentId.set(res.paymentId);
        
        // Ensure base64 prefix or construct QR image generator URL if raw EMVCo string is returned
        let qr = res.qrCode;
        if (qr) {
          if (qr.startsWith('000201')) {
            // Raw EMVCo QR code string - generate image using qrserver API
            qr = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`;
          } else if (!qr.startsWith('data:') && !qr.startsWith('http')) {
            qr = 'data:image/png;base64,' + qr;
          }
        }
        this.qrCode.set(qr);
        // Clear qrLink so that frontend does not attempt to bind the iframe/webpage checkout URL to image src
        this.qrLink.set(null);
        this.paymentContent.set(res.paymentContent);
        this.bankCode.set(res.bankCode || 'Vietcombank');
        this.bankAccount.set(res.bankAccount || '0123456789');
        this.bankAccountName.set(res.bankAccountName || 'AIMS DIGITAL ARCHIVE');
        
        this.startQrTimer(new Date(res.expiredAt));
        this.startStatusPolling(res.paymentId);
      },
      error: (err) => {
        this.loading.set(false);
        this.showAlert('VietQR Error', err.error?.message || 'Unable to create QR payment code.', 'error');
      }
    });
  }

  startQrTimer(expiredAt: Date) {
    if (this.timerSubscription) {
      clearInterval(this.timerSubscription);
    }

    const targetTime = expiredAt.getTime();
    this.isExpired.set(false);

    this.timerSubscription = setInterval(() => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        this.qrTimeLeft.set('00:00');
        this.isExpired.set(true);
        clearInterval(this.timerSubscription);
        this.stopStatusPolling();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
      const secStr = seconds < 10 ? `0${seconds}` : `${seconds}`;

      this.qrTimeLeft.set(`${minStr}:${secStr}`);
    }, 1000);
  }

  startStatusPolling(paymentId: number) {
    if (this.pollingSubscription) {
      clearInterval(this.pollingSubscription);
    }

    this.checkPaymentStatus(paymentId);
    this.pollingSubscription = setInterval(() => {
      this.checkPaymentStatus(paymentId);
    }, 5000);
  }

  stopStatusPolling() {
    if (this.pollingSubscription) {
      clearInterval(this.pollingSubscription);
      this.pollingSubscription = null;
    }
  }

  checkPaymentStatus(paymentId: number) {
    this.paymentService.getVietqrPaymentStatus(paymentId).subscribe({
      next: (res) => {
        if (res.status === 'PAID') {
          this.stopStatusPolling();
          if (this.timerSubscription) {
            clearInterval(this.timerSubscription);
          }
          localStorage.removeItem('aims_cart');
          this.router.navigate(['/payment-result'], {
            queryParams: { success: 'true', orderId: this.orderId() }
          });
        } else if (res.status === 'EXPIRED' || res.status === 'FAILED') {
          this.stopStatusPolling();
          if (this.timerSubscription) {
            clearInterval(this.timerSubscription);
          }
          this.isExpired.set(true);
          this.qrTimeLeft.set('00:00');
        }
      },
      error: () => {}
    });
  }

  confirmPayment() {
    const currentOrderId = this.orderId();
    if (!currentOrderId) {
      this.showAlert('Order Error', 'No valid order ID found!', 'error');
      return;
    }

    if (this.paymentMethod() === 'QR') {
      const pId = this.paymentId();
      if (pId) {
        this.loading.set(true);
        this.statusMessage.set('Confirming payment with VietQR...');
        this.paymentService.triggerVietqrTestCallback(pId).subscribe({
          next: () => {
            this.loading.set(false);
          },
          error: (err) => {
            setTimeout(() => {
              this.paymentService.getVietqrPaymentStatus(pId).subscribe({
                next: (res) => {
                  this.loading.set(false);
                  if (res.status === 'PAID') {
                    this.stopStatusPolling();
                    clearInterval(this.timerSubscription);
                    localStorage.removeItem('aims_cart');
                    this.router.navigate(['/payment-result'], {
                      queryParams: { success: 'true', orderId: this.orderId() }
                    });
                  } else {
                    this.showAlert('Payment Error', err.error?.message || 'Failed to confirm payment.', 'error');
                  }
                },
                error: () => {
                  this.loading.set(false);
                  this.showAlert('Payment Error', err.error?.message || 'Failed to confirm payment.', 'error');
                }
              });
            }, 5000);
          }
        });
      } else {
        this.loadOrCreateVietqrPayment();
      }
    } else {
      this.loading.set(true);
      this.statusMessage.set('Preparing PayPal transaction...');

      this.paymentService.createOrder(currentOrderId).subscribe({
        next: (res) => {
          if (res.approveUrl) {
            window.location.href = res.approveUrl;
          } else {
            this.loading.set(false);
            this.showAlert('PayPal Error', 'No payment link received from PayPal.', 'error');
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.showAlert(
            'Connection Error',
            err.error?.message || 'Error connecting to PayPal payment gateway.',
            'error'
          );
        }
      });
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.showAlert('Copied', `Copied "${text}" to clipboard.`, 'success');
    }).catch(err => {
      console.error('Unable to copy:', err);
    });
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

