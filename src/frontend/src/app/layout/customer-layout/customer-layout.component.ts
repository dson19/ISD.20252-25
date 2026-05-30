import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
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
  private readonly searchKeywordChange$ = new Subject<string>();
  private readonly searchSubscription: Subscription;

  constructor(
    private readonly cartService: CartService,
    private readonly router: Router,
  ) {
    this.cartItemCount = this.cartService.itemCount;
    this.cartSubscription = this.cartService.items$.subscribe(() => {
      this.cartItemCount = this.cartService.itemCount;
    });
    this.searchSubscription = this.searchKeywordChange$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
      )
      .subscribe(() => this.searchProducts());
  }

  ngOnDestroy(): void {
    this.cartSubscription.unsubscribe();
    this.searchSubscription.unsubscribe();
  }

  onSearchKeywordChange(value: string): void {
    this.searchKeywordChange$.next(value.trim());
  }

  searchProducts(): void {
    const keyword = this.searchKeyword.trim();
    this.router.navigate(['/'], {
      queryParams: keyword ? { keyword } : {},
    });
  }
}
