import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../services/order.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html'
})
export class OrdersComponent implements OnInit {
  orders: any[] = [];
  activeTab: 'pending' | 'refund' = 'pending';
  isLoading = false;

  // Pagination properties
  currentPage = 1;
  pageSize = 30;
  totalItems = 0;
  totalPages = 0;

  // Detail Modal properties
  selectedOrder: any = null;
  isDetailModalOpen = false;
  detailLoading = false;

  // Statistic getters for Dashboard Metrics Panel
  get totalOrdersCount(): number {
    return this.totalItems;
  }

  get pendingOrdersCount(): number {
    return this.orders.filter(o => o.status === 'PENDING').length;
  }

  get paidOrdersCount(): number {
    return this.orders.filter(o => o.status === 'PENDING_PROCESSING').length;
  }

  get processingOrdersCount(): number {
    return this.orders.filter(o => o.status === 'APPROVED' || o.status === 'PROCESSING').length;
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

  constructor(
    private readonly orderService: OrderService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadOrders();
  }

  setTab(tab: 'pending' | 'refund') {
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading = true;
    const req = this.activeTab === 'pending'
      ? this.orderService.getPendingOrders(this.currentPage, this.pageSize)
      : this.orderService.getVietqrRefunds(this.currentPage, this.pageSize);

    req.subscribe({
      next: (res) => {
        this.orders = res.items;
        this.totalItems = res.total;
        this.totalPages = res.totalPages;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.showAlert('Lỗi', 'Không thể tải danh sách đơn hàng từ hệ thống.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadOrders();
  }

  // Thao tác xem chi tiết đơn hàng
  viewDetails(orderId: number) {
    this.detailLoading = true;
    this.orderService.getOrderDetail(orderId).subscribe({
      next: (order) => {
        this.selectedOrder = order;
        this.isDetailModalOpen = true;
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.detailLoading = false;
        this.showAlert('Lỗi', 'Không thể tải chi tiết đơn hàng này.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  closeDetailModal() {
    this.selectedOrder = null;
    this.isDetailModalOpen = false;
    this.cdr.detectChanges();
  }

  // Thao tác xử lý đơn hàng
  approveOrder(orderId: number) {
    this.showConfirm(
      'Xác nhận duyệt đơn',
      `Bạn có chắc chắn muốn duyệt và chuẩn bị giao cho đơn hàng #${orderId}?`,
      'info',
      () => {
        this.orderService.approveOrder(orderId).subscribe({
          next: () => {
            this.showAlert('Thành công', `Đã duyệt đơn hàng #${orderId} thành công!`, 'success');
            this.closeDetailModal();
            this.loadOrders();
          },
          error: (err) => {
            this.showAlert('Lỗi', err.error?.message || 'Không thể duyệt đơn hàng.', 'error');
          }
        });
      }
    );
  }

  rejectOrder(orderId: number) {
    this.showConfirm(
      'Xác nhận từ chối đơn',
      `Bạn có chắc chắn muốn từ chối đơn hàng #${orderId}?`,
      'danger',
      () => {
        this.orderService.rejectOrder(orderId).subscribe({
          next: (res) => {
            if (res.status === 'REFUND_PENDING') {
              this.showAlert('Chờ hoàn tiền', `Đơn hàng #${orderId} đã bị từ chối và chuyển sang trạng thái Chờ hoàn tiền VietQR thủ công.`, 'warning');
            } else {
              this.showAlert('Thành công', `Đã từ chối đơn hàng #${orderId} thành công!`, 'success');
            }
            this.closeDetailModal();
            this.loadOrders();
          },
          error: (err) => {
            this.showAlert('Lỗi', err.error?.message || 'Không thể từ chối đơn hàng.', 'error');
          }
        });
      }
    );
  }

  cancelOrder(orderId: number) {
    this.showConfirm(
      'Xác nhận hủy đơn',
      `Bạn có chắc chắn muốn hủy đơn hàng #${orderId}?`,
      'danger',
      () => {
        this.orderService.cancelOrder(orderId).subscribe({
          next: (res) => {
            if (res.status === 'REFUND_PENDING') {
              this.showAlert('Chờ hoàn tiền', `Đơn hàng #${orderId} đã được hủy và chuyển sang trạng thái Chờ hoàn tiền VietQR thủ công.`, 'warning');
            } else {
              this.showAlert('Thành công', `Đã hủy đơn hàng #${orderId} thành công!`, 'success');
            }
            this.closeDetailModal();
            this.loadOrders();
          },
          error: (err) => {
            this.showAlert('Lỗi', err.error?.message || 'Không thể hủy đơn hàng.', 'error');
          }
        });
      }
    );
  }

  confirmVietqrRefund(orderId: number) {
    this.showConfirm(
      'Xác nhận đã hoàn tiền VietQR',
      `Bạn có chắc chắn muốn xác nhận đã chuyển khoản hoàn tiền cho đơn hàng #${orderId}? Trạng thái đơn hàng sẽ chuyển sang Đã hoàn tiền (REFUNDED).`,
      'warning',
      () => {
        this.orderService.confirmVietqrRefund(orderId).subscribe({
          next: () => {
            this.showAlert('Thành công', `Đã xác nhận hoàn tiền VietQR cho đơn hàng #${orderId}!`, 'success');
            this.closeDetailModal();
            this.loadOrders();
          },
          error: (err) => {
            this.showAlert('Lỗi', err.error?.message || 'Không thể xác nhận hoàn tiền đơn hàng.', 'error');
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
