import { Component, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../services/payment.service';

interface Order {
  id: string;
  customer: string;
  phone: string;
  total: number;
  paymentMethod: string;
  date: string;
  status: 'PENDING' | 'PAID' | 'PROCESSING';
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html'
})
export class OrdersComponent {
  // Statistic getters for Dashboard Metrics Panel
  get totalOrdersCount(): number {
    return this.orders.length;
  }

  get pendingOrdersCount(): number {
    return this.orders.filter(o => o.status === 'PENDING').length;
  }

  get paidOrdersCount(): number {
    return this.orders.filter(o => o.status === 'PAID').length;
  }

  get processingOrdersCount(): number {
    return this.orders.filter(o => o.status === 'PROCESSING').length;
  }

  // Custom Popup Alert/Confirm properties
  isConfirmModalOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'info' | 'warning' | 'danger' = 'info';
  confirmAction: (() => void) | null = null;

  isAlertModalOpen = false;
  alertTitle = '';
  alertMessage = '';
  alertType: 'success' | 'error' | 'warning' | 'info' = 'info';

  orders: Order[] = [
    {
      id: '#AIMS-2024-VN2481',
      customer: 'Nguyễn Minh Anh',
      phone: '0987654321',
      total: 258300,
      paymentMethod: 'VISA .... 9012',
      date: '24/10/2024 14:32',
      status: 'PENDING'
    },
    {
      id: '#AIMS-2024-VN2482',
      customer: 'Trần Thu Hà',
      phone: '0912345678',
      total: 450000,
      paymentMethod: 'Chuyển khoản',
      date: '24/10/2024 11:15',
      status: 'PAID'
    },
    {
      id: '#AIMS-2024-VN2483',
      customer: 'Lê Hoàng Nam',
      phone: '0905123456',
      total: 95000,
      paymentMethod: 'QR Banking',
      date: '23/10/2024 09:44',
      status: 'PROCESSING'
    }
  ];

  refundOrderId = signal<number | null>(null);
  refundLoading = signal<boolean>(false);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  executeRefund() {
    const id = this.refundOrderId();
    if (!id) {
      this.showAlert('Thông tin thiếu', 'Vui lòng nhập ID đơn hàng hợp lệ để hoàn tiền!', 'warning');
      return;
    }

    this.showConfirm(
      'Xác nhận hoàn tiền',
      `Bạn có chắc chắn muốn hoàn tiền cho đơn hàng #${id} qua cổng PayPal? Thao tác này không thể hoàn tác.`,
      'warning',
      () => {
        this.refundLoading.set(true);
        this.paymentService.refundOrder(id).subscribe({
          next: (res) => {
            this.refundLoading.set(false);
            this.showAlert(
              'Thành công',
              `Hoàn tiền thành công cho đơn hàng #${id}! Trạng thái PayPal: ${res.status || 'REFUNDED'}`,
              'success'
            );
            this.refundOrderId.set(null);
          },
          error: (err) => {
            this.refundLoading.set(false);
            this.showAlert(
              'Hoàn tiền thất bại',
              err.error?.message || `Lỗi khi hoàn tiền đơn hàng #${id}. Vui lòng kiểm tra lại.`,
              'error'
            );
          }
        });
      }
    );
  }

  // Helper Methods for Custom Alert & Confirm Popups
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

  showConfirm(title: string, message: string, type: 'info' | 'warning' | 'danger', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.confirmAction = action;
    this.isConfirmModalOpen = true;
    this.cdr.detectChanges();
  }

  closeConfirm() {
    this.isConfirmModalOpen = false;
    this.confirmAction = null;
    this.cdr.detectChanges();
  }

  triggerConfirmAction() {
    if (this.confirmAction) {
      this.confirmAction();
    }
    this.closeConfirm();
  }

}
