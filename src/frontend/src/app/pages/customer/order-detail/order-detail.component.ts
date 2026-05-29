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
      if (orderIdParam) {
        this.orderId.set(Number(orderIdParam));
        this.loadOrderDetails();
      } else {
        this.orderLoaded.set(true);
      }
    });
  }

  loadOrderDetails() {
    const id = this.orderId();
    if (!id) return;

    this.paymentService.getOrderDetail(id).subscribe({
      next: (data) => {
        this.order.set(data);
        this.orderLoaded.set(true);
      },
      error: (err) => {
        console.error('Lỗi khi lấy thông tin đơn hàng:', err);
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
    // Khách hàng được phép hủy khi đơn hàng ở trạng thái PENDING hoặc PENDING_PROCESSING
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

    if (paymentMethod === 'PAYPAL') {
      // Đơn hàng thanh toán bằng PayPal -> Phải hoàn tiền tự động qua PayPal thành công mới cho hủy đơn
      this.paymentService.refundOrder(id).subscribe({
        next: (res) => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          this.openModal(
            'Hủy đơn hàng thành công',
            'Đơn hàng đã được hủy và tiền đã hoàn lại tự động về tài khoản PayPal của bạn.',
            'success'
          );
          this.loadOrderDetails();
        },
        error: (err) => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          this.openModal(
            'Lỗi hoàn tiền PayPal',
            `Không thể hoàn tiền đơn hàng qua PayPal. Hủy đơn thất bại!\nChi tiết lỗi: ${err.error?.message || err.message || 'Lỗi kết nối cổng thanh toán.'}`,
            'error'
          );
        }
      });
    } else {
      // Đơn hàng thanh toán bằng VietQR hoặc chưa thanh toán -> Gọi API hủy đơn thường
      this.paymentService.cancelOrder(id).subscribe({
        next: () => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          if (paymentMethod === 'VIETQR') {
            this.openModal(
              'Hủy đơn hàng thành công',
              'Đơn hàng đã được hủy thành công. Do đơn hàng được thanh toán bằng VietQR, ban quản trị sẽ liên hệ hoàn tiền thủ công cho bạn trong thời gian sớm nhất.',
              'success'
            );
          } else {
            this.openModal(
              'Hủy đơn hàng thành công',
              'Đơn hàng của bạn đã được hủy thành công trên hệ thống.',
              'success'
            );
          }
          this.loadOrderDetails();
        },
        error: (err) => {
          this.cancelLoading.set(false);
          this.showConfirmModal.set(false);
          this.openModal(
            'Không thể hủy đơn hàng',
            `Có lỗi xảy ra khi hủy đơn hàng.\nChi tiết lỗi: ${err.error?.message || err.message}`,
            'error'
          );
        }
      });
    }
  }
}
