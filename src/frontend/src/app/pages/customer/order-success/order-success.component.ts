import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-success.component.html'
})
export class OrderSuccessComponent {
  orderId = '#AIMS';
  transactionId = '-';
  orderDate = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
  total = 0;

  constructor(private readonly route: ActivatedRoute) {
    const query = this.route.snapshot.queryParamMap;
    const orderId = query.get('orderId');
    const amount = Number(query.get('amount'));

    this.orderId = orderId ? `#AIMS-${orderId}` : this.orderId;
    this.transactionId = query.get('transactionId') || this.transactionId;
    this.total = Number.isFinite(amount) ? amount : this.total;
  }
}
