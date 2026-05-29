import { Component, signal } from '@angular/core';
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

  constructor(private paymentService: PaymentService) {}

  executeRefund() {
    const id = this.refundOrderId();
    if (!id) {
      alert('Vui lòng nhập ID đơn hàng hợp lệ để hoàn tiền!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn hoàn tiền cho đơn hàng #${id} qua cổng PayPal?`)) {
      return;
    }

    this.refundLoading.set(true);
    this.paymentService.refundOrder(id).subscribe({
      next: (res) => {
        this.refundLoading.set(false);
        alert(`Hoàn tiền thành công cho đơn hàng #${id}! Trạng thái PayPal: ${res.status || 'REFUNDED'}`);
        this.refundOrderId.set(null);
      },
      error: (err) => {
        this.refundLoading.set(false);
        alert(err.error?.message || `Lỗi khi hoàn tiền đơn hàng #${id}. Vui lòng kiểm tra lại.`);
      }
    });
  }
}
