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
  calculatingShipping = false;
  submitting = false;
  errorMessage = '';
  shippingError = '';
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
  private activeShippingRequest: Subscription | null = null;

  constructor(
    private readonly router: Router,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
  ) {
    this.cartItems = this.cartService.getCartItems();
    this.cartSubscription = this.cartService.items$.subscribe((items) => {
      this.cartItems = items;
      this.calculateShippingFee();
    });
    this.calculateShippingFee();
  }

  ngOnDestroy(): void {
    this.cartSubscription.unsubscribe();
    this.activeShippingRequest?.unsubscribe();
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

  calculateShippingFee(): void {
    this.activeShippingRequest?.unsubscribe();
    this.shippingError = '';

    if (this.cartItems.length === 0 || !this.deliveryInfo.province.trim()) {
      this.calculatingShipping = false;
      return;
    }

    this.calculatingShipping = true;
    this.activeShippingRequest = this.orderService
      .calculateShippingFee(this.cartItems, this.deliveryInfo.province)
      .subscribe({
        next: (result) => {
          this.shippingFee = Number(result.shippingFee);
          this.calculatingShipping = false;
        },
        error: () => {
          this.shippingError = 'Khong the tinh phi van chuyen. Vui long thu lai.';
          this.calculatingShipping = false;
        },
      });
  }

  continueToPayment(): void {
    if (this.cartItems.length === 0) {
      this.router.navigate(['/cart']);
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.stockIssues = [];

    this.orderService.placeOrder(this.cartItems, this.deliveryInfo).subscribe({
      next: (order) => {
        this.cartService.clearCart();
        this.submitting = false;
        this.router.navigate(['/invoice'], {
          queryParams: {
            orderId: order.orderID,
          },
        });
      },
      error: (error: HttpErrorResponse) => {
        this.submitting = false;
        this.errorMessage =
          error.status === 400
            ? 'Một số sản phẩm không đủ tồn kho. Vui lòng quay lại giỏ hàng để cập nhật số lượng.'
            : 'Không thể đặt hàng. Hãy kiểm tra backend API và thử lại.';
        this.stockIssues = this.extractStockIssues(error);
      },
    });
  }

  itemTotal(item: CartItem): number {
    return item.price * item.quantity;
  }

  stockIssueTitle(issue: StockIssue): string {
    return this.cartItems.find((item) => item.id === issue.productId)?.title ?? `Sản phẩm #${issue.productId}`;
  }

  private extractStockIssues(error: HttpErrorResponse): StockIssue[] {
    const response = error.error as { issues?: StockIssue[] } | undefined;
    return Array.isArray(response?.issues) ? response.issues : [];
  }
}
