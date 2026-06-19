import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderListFilters, OrderService } from '../../../services/order.service';

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

  // Filter properties
  searchQuery = '';
  dateRange: OrderListFilters['dateRange'] = 'ALL';
  paymentMethod: OrderListFilters['paymentMethod'] = 'ALL';

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
    if (tab === 'refund' && (this.paymentMethod === 'PAYPAL' || this.paymentMethod === 'UNPAID')) {
      this.paymentMethod = 'ALL';
    }
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading = true;
    const filters = this.currentFilters();
    const req = this.activeTab === 'pending'
      ? this.orderService.getPendingOrders(this.currentPage, this.pageSize, filters)
      : this.orderService.getVietqrRefunds(this.currentPage, this.pageSize, filters);

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
        this.showAlert('Error', 'Unable to load the order list from the system.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadOrders();
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadOrders();
  }

  clearFilters() {
    this.searchQuery = '';
    this.dateRange = 'ALL';
    this.paymentMethod = 'ALL';
    this.currentPage = 1;
    this.loadOrders();
  }

  private currentFilters(): OrderListFilters {
    return {
      search: this.searchQuery,
      dateRange: this.dateRange,
      paymentMethod: this.paymentMethod,
    };
  }

  // View order details
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
        this.showAlert('Error', 'Unable to load this order detail.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  closeDetailModal() {
    this.selectedOrder = null;
    this.isDetailModalOpen = false;
    this.cdr.detectChanges();
  }

  // Order processing actions
  approveOrder(orderId: number) {
    this.showConfirm(
      'Confirm Approval',
      `Are you sure you want to approve and prepare order #${orderId} for delivery?`,
      'info',
      () => {
        this.orderService.approveOrder(orderId).subscribe({
          next: () => {
            this.showAlert('Success', `Order #${orderId} approved successfully!`, 'success');
            this.closeDetailModal();
            this.loadOrders();
          },
          error: (err) => {
            this.showAlert('Error', err.error?.message || 'Unable to approve the order.', 'error');
          }
        });
      }
    );
  }

  rejectOrder(orderId: number) {
    this.showConfirm(
      'Confirm Rejection',
      `Are you sure you want to reject order #${orderId}?`,
      'danger',
      () => {
        this.orderService.rejectOrder(orderId).subscribe({
          next: (res) => {
            if (res.status === 'REFUND_PENDING') {
              this.showAlert('Refund Pending', `Order #${orderId} has been rejected and moved to Manual VietQR Refund Pending status.`, 'warning');
            } else {
              this.showAlert('Success', `Order #${orderId} rejected successfully!`, 'success');
            }
            this.closeDetailModal();
            this.loadOrders();
          },
          error: (err) => {
            this.showAlert('Error', err.error?.message || 'Unable to reject the order.', 'error');
          }
        });
      }
    );
  }

  cancelOrder(orderId: number) {
    this.showConfirm(
      'Confirm Cancellation',
      `Are you sure you want to cancel order #${orderId}?`,
      'danger',
      () => {
        this.orderService.cancelOrder(orderId).subscribe({
          next: (res) => {
            if (res.status === 'REFUND_PENDING') {
              this.showAlert('Refund Pending', `Order #${orderId} has been cancelled and moved to Manual VietQR Refund Pending status.`, 'warning');
            } else {
              this.showAlert('Success', `Order #${orderId} cancelled successfully!`, 'success');
            }
            this.closeDetailModal();
            this.loadOrders();
          },
          error: (err) => {
            this.showAlert('Error', err.error?.message || 'Unable to cancel the order.', 'error');
          }
        });
      }
    );
  }

  confirmVietqrRefund(orderId: number) {
    this.showConfirm(
      'Confirm VietQR Refund',
      `Are you sure you want to confirm the refund transfer for order #${orderId}? The order status will change to Refunded (REFUNDED).`,
      'warning',
      () => {
        this.orderService.confirmVietqrRefund(orderId).subscribe({
          next: () => {
            this.showAlert('Success', `VietQR refund confirmed for order #${orderId}!`, 'success');
            this.closeDetailModal();
            this.loadOrders();
          },
          error: (err) => {
            this.showAlert('Error', err.error?.message || 'Unable to confirm the order refund.', 'error');
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
