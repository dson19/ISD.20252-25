import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './payment.component.html'
})
export class PaymentComponent {
  totalAmount = 258300;
  paymentMethod: 'QR' | 'CARD' = 'QR';
  qrTimeLeft = '09:59';
  
  // Card form details
  cardNumber = '';
  cardExpiry = '';
  cardCvv = '';
  cardName = '';

  constructor(private router: Router) {}

  selectMethod(method: 'QR' | 'CARD') {
    this.paymentMethod = method;
  }

  confirmPayment() {
    // Navigate to order success
    this.router.navigate(['/order-success']);
  }
}
