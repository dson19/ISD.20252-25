import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  imports: [CommonModule],
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
}
