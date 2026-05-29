import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../../services/cart.service';
import { OrderService, StockIssue } from '../../../services/order.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.component.html'
})
export class CartComponent implements OnDestroy {
  cartItems: CartItem[] = [];
  checkingStock = false;
  stockCheckError = '';
  stockIssuesByProductId = new Map<number, StockIssue>();

  private readonly subscriptions = new Subscription();
  private activeStockCheck: Subscription | null = null;

  constructor(
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
  ) {
    this.cartItems = this.cartService.getCartItems();
    this.subscriptions.add(
      this.cartService.items$.subscribe((items) => {
        this.cartItems = items;
        this.checkStock();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.activeStockCheck?.unsubscribe();
  }

  get subtotal(): number {
    return this.cartService.priceExcludedVAT;
  }

  get hasStockIssues(): boolean {
    return this.stockIssuesByProductId.size > 0;
  }

  get canPlaceOrder(): boolean {
    return this.cartItems.length > 0 && !this.checkingStock && !this.hasStockIssues && !this.stockCheckError;
  }

  increaseQuantity(item: CartItem): void {
    this.cartService.updateQuantity(item.id, item.quantity + 1);
  }

  decreaseQuantity(item: CartItem): void {
    this.cartService.updateQuantity(item.id, Math.max(1, item.quantity - 1));
  }

  updateQuantity(item: CartItem, quantity: number): void {
    this.cartService.updateQuantity(item.id, quantity);
  }

  removeItem(item: CartItem): void {
    this.cartService.removeItem(item.id);
  }

  itemTotal(item: CartItem): number {
    return item.price * item.quantity;
  }

  stockIssueFor(item: CartItem): StockIssue | undefined {
    return this.stockIssuesByProductId.get(item.id);
  }

  private checkStock(): void {
    this.activeStockCheck?.unsubscribe();
    this.stockCheckError = '';

    if (this.cartItems.length === 0) {
      this.checkingStock = false;
      this.stockIssuesByProductId.clear();
      return;
    }

    this.checkingStock = true;
    this.activeStockCheck = this.orderService.checkCartStock(this.cartItems).subscribe({
      next: (result) => {
        this.stockIssuesByProductId = new Map(
          result.issues.map((issue) => [issue.productId, issue]),
        );
        this.checkingStock = false;
      },
      error: () => {
        this.stockIssuesByProductId.clear();
        this.stockCheckError = 'Không thể kiểm tra tồn kho. Vui lòng thử lại sau.';
        this.checkingStock = false;
      },
    });
  }
}
