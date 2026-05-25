import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout.component.html'
})
export class CheckoutComponent {
  subtotal = 203000;
  vat = 20300;
  shippingFee = 35000;

  get total(): number {
    return this.subtotal + this.vat + this.shippingFee;
  }

  constructor(private router: Router) {}

  continueToPayment() {
    this.router.navigate(['/payment']);
  }
}
