import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-success.component.html'
})
export class OrderSuccessComponent {
  orderId = '#AIMS-2024-VN2481';
  transactionId = 'TXN-2024-VN2481';
  orderDate = '24/10/2024 • 14:32';
  total = 258300;
}
