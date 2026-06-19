import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { PaymentService } from '../../../services/payment.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-detail.component.html'
})
export class OrderDetailComponent implements OnInit {
  orderId = signal<number | null>(null);
  customerAccessToken = signal<string | null>(null);
  order = signal<any>(null);
  orderLoaded = signal<boolean>(false);
  showModal = signal<boolean>(false);
  modalTitle = signal<string>('');
  modalMessage = signal<string>('');
  modalType = signal<'success' | 'error'>('success');
  showConfirmModal = signal<boolean>(false);
  cancelLoading = signal<boolean>(false);

  constructor(
    private route: ActivatedRoute,
    private paymentService: PaymentService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const orderIdParam = params['orderId'];
      const tokenParam = params['token'];
      const intent = params['intent'];
      if (orderIdParam) {
        this.orderId.set(Number(orderIdParam));
        this.customerAccessToken.set(tokenParam || null);
        this.loadOrderDetails(intent === 'cancel');
      } else {
        this.orderLoaded.set(true);
      }
    });
  }

  loadOrderDetails(openCancelAfterLoad = false) {
    const id = this.orderId();
    if (!id) return;

    const token = this.customerAccessToken();
    const request = token
      ? this.paymentService.getCustomerOrderDetail(id, token)
      : this.paymentService.getOrderDetail(id);

    request.subscribe({
      next: (data) => {
        this.order.set(data);
        this.orderLoaded.set(true);
        if (openCancelAfterLoad && this.canCancel()) {
          this.showConfirmCancel();
        }
      },
      error: (err) => {
        console.error('Error loading order details:', err);
        this.orderLoaded.set(true);
      }
    });
  }

  openModal(title: string, message: string, type: 'success' | 'error' = 'success') {
    this.modalTitle.set(title);
    this.modalMessage.set(message);
    this.modalType.set(type);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  canCancel(): boolean {
    const currentOrder = this.order();
    if (!currentOrder) return false;
    // Customer can cancel when order is PENDING or PENDING_PROCESSING
    return ['PENDING', 'PENDING_PROCESSING'].includes(currentOrder.status);
  }

  showConfirmCancel() {
    this.showConfirmModal.set(true);
  }

  closeConfirmModal() {
    this.showConfirmModal.set(false);
  }

  executeCancelOrder() {
    const id = this.orderId();
    const currentOrder = this.order();
    if (!id || !currentOrder) return;

    this.cancelLoading.set(true);

    const paymentMethod = currentOrder.paymentMethod;
    const token = this.customerAccessToken();

    if (token) {
      this.paymentService.cancelCustomerOrder(id, token).subscribe({
        next: (res) => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          this.openModal(
            'Order Cancelled Successfully',
            res.status === 'REFUND_PENDING'
              ? 'Your order has been cancelled. VietQR refund is pending admin approval.'
              : 'Your order has been cancelled and refund status updated.',
            'success'
          );
          this.loadOrderDetails();
        },
        error: (err) => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          this.openModal(
            'Unable to Cancel Order',
            `An error occurred while cancelling the order.\nError: ${err.error?.message || err.message}`,
            'error'
          );
        }
      });
      return;
    }

    if (paymentMethod === 'PAYPAL') {
      // PayPal orders: must successfully refund via PayPal before cancellation
      this.paymentService.refundOrder(id).subscribe({
        next: (res) => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          this.openModal(
            'Order Cancelled Successfully',
            'Your order has been cancelled and the amount has been automatically refunded to your PayPal account.',
            'success'
          );
          this.loadOrderDetails();
        },
        error: (err) => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          this.openModal(
            'PayPal Refund Error',
            `Unable to refund the order via PayPal. Cancellation failed!\nError: ${err.error?.message || err.message || 'Payment gateway connection error.'}`,
            'error'
          );
        }
      });
    } else {
      // VietQR or unpaid orders: use standard cancel API
      this.paymentService.cancelOrder(id).subscribe({
        next: () => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          if (paymentMethod === 'VIETQR') {
            this.openModal(
              'Order Cancelled Successfully',
              'Your order has been successfully cancelled. Since payment was made via VietQR, our admin team will contact you for a manual refund as soon as possible.',
              'success'
            );
          } else {
            this.openModal(
              'Order Cancelled Successfully',
              'Your order has been successfully cancelled.',
              'success'
            );
          }
          this.loadOrderDetails();
        },
        error: (err) => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          this.openModal(
            'Unable to Cancel Order',
            `An error occurred while cancelling the order.\nError: ${err.error?.message || err.message}`,
            'error'
          );
        }
      });
    }
  }
}
