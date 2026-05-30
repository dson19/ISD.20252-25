import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [FormsModule, RouterOutlet, RouterLink],
  templateUrl: './customer-layout.component.html'
})
export class CustomerLayoutComponent implements OnDestroy {
  cartItemCount = 0;
  searchKeyword = '';

  private readonly cartSubscription: Subscription;
  private searchDebounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastSubmittedKeyword = '';

  constructor(
    private readonly cartService: CartService,
    private readonly router: Router,
  ) {
    this.cartItemCount = this.cartService.itemCount;
    this.cartSubscription = this.cartService.items$.subscribe(() => {
      this.cartItemCount = this.cartService.itemCount;
    });
  }

  ngOnDestroy(): void {
    this.cartSubscription.unsubscribe();
    if (this.searchDebounceTimeoutId) {
      clearTimeout(this.searchDebounceTimeoutId);
    }
  }

  onSearchKeywordChange(keyword: string): void {
    this.searchKeyword = keyword;
    if (this.searchDebounceTimeoutId) {
      clearTimeout(this.searchDebounceTimeoutId);
    }

    this.searchDebounceTimeoutId = setTimeout(() => {
      this.searchProducts();
    }, 300);
  }

  searchProducts(): void {
    const keyword = this.searchKeyword.trim();
    if (keyword === this.lastSubmittedKeyword) {
      return;
    }

    this.lastSubmittedKeyword = keyword;
    this.router.navigate(['/'], {
      queryParams: keyword ? { keyword } : {},
      replaceUrl: true,
    });
  }
}
