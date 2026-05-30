import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../../services/cart.service';
import { DeliveryInfo, OrderService, StockIssue } from '../../../services/order.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.component.html'
})
export class CheckoutComponent implements OnDestroy {
  cartItems: CartItem[] = [];
  shippingFee = 35000;
  submitting = false;
  checkingStock = false;
  errorMessage = '';
  stockIssues: StockIssue[] = [];

  deliveryInfo: DeliveryInfo = {
    receiverName: '',
    email: '',
    phoneNumber: '',
    province: '',
    address: '',
    deliveryNotes: '',
  };

  private readonly cartSubscription: Subscription;
  private activeSubmitSubscription: Subscription | null = null;

  constructor(
    private readonly router: Router,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
  ) {
    this.cartItems = this.cartService.getCartItems();
    this.cartSubscription = this.cartService.items$.subscribe((items) => {
      this.cartItems = items;
      this.stockIssues = [];
    });
  }

  ngOnDestroy(): void {
    this.cartSubscription.unsubscribe();
    this.activeSubmitSubscription?.unsubscribe();
  }

  get subtotal(): number {
    return this.cartService.priceExcludedVAT;
  }

  get vat(): number {
    return this.cartService.vat;
  }

  get total(): number {
    return this.subtotal + this.vat + this.shippingFee;
  }

  continueToPayment(): void {
    if (this.cartItems.length === 0) {
      this.router.navigate(['/cart']);
      return;
    }

    this.submitting = true;
    this.checkingStock = true;
    this.errorMessage = '';
    this.stockIssues = [];

    this.activeSubmitSubscription?.unsubscribe();
    this.activeSubmitSubscription = this.orderService.checkCartStock(this.cartItems).subscribe({
      next: (stockCheck) => {
        this.checkingStock = false;
        if (!stockCheck.available) {
          this.submitting = false;
          this.stockIssues = stockCheck.issues;
          this.errorMessage = 'Một số sản phẩm không đủ tồn kho. Vui lòng quay lại giỏ hàng để cập nhật số lượng.';
          return;
        }

        this.submitOrder();
      },
      error: () => {
        this.checkingStock = false;
        this.submitting = false;
        this.errorMessage = 'Không thể kiểm tra tồn kho. Vui lòng thử lại sau.';
      },
    });
  }

  itemTotal(item: CartItem): number {
    return item.price * item.quantity;
  }

  stockIssueTitle(issue: StockIssue): string {
    return this.cartItems.find((item) => item.id === issue.productId)?.title ?? `Sản phẩm #${issue.productId}`;
  }

  private submitOrder(): void {
    this.activeSubmitSubscription = this.orderService.placeOrder(this.cartItems, this.deliveryInfo).subscribe({
      next: () => {
        this.cartService.clearCart();
        this.submitting = false;
        this.checkingStock = false;
        this.router.navigate(['/payment']);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting = false;
        this.checkingStock = false;
        this.errorMessage =
          error.status === 400
            ? 'Một số sản phẩm không đủ tồn kho. Vui lòng quay lại giỏ hàng để cập nhật số lượng.'
            : 'Không thể đặt hàng. Hãy kiểm tra backend API và thử lại.';
        this.stockIssues = this.extractStockIssues(error);
      },
    });
  }

  private extractStockIssues(error: HttpErrorResponse): StockIssue[] {
    const response = error.error as { issues?: StockIssue[] } | undefined;
    return Array.isArray(response?.issues) ? response.issues : [];
  }
}
