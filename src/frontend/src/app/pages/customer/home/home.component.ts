import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { of, Subscription } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { CartService } from '../../../services/cart.service';
import { Product, ProductSearchParams, ProductService } from '../../../services/product.service';

interface CategoryFilter {
  label: string;
  value: string;
}

interface PriceFilter {
  label: string;
  minPrice?: number;
  maxPrice?: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit, OnDestroy {
  categories: CategoryFilter[] = [
    { label: 'Sách', value: 'BOOK' },
    { label: 'CD', value: 'CD' },
    { label: 'DVD', value: 'DVD' },
    { label: 'Báo chí', value: 'NEWSPAPER' },
  ];

  priceFilters: PriceFilter[] = [
    { label: 'Dưới 100,000', maxPrice: 100000 },
    { label: '100,000 - 500,000', minPrice: 100000, maxPrice: 500000 },
    { label: '500,000 - 1,000,000', minPrice: 500000, maxPrice: 1000000 },
    { label: 'Trên 1,000,000', minPrice: 1000000 },
  ];

  products: Product[] = [];
  selectedCategories = new Set<string>();
  selectedPriceIndex: number | null = null;
  keyword = '';
  loading = false;
  errorMessage = '';
  toastMessage = '';

  private readonly subscriptions = new Subscription();
  private productsSubscription: Subscription | null = null;
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        this.keyword = params.get('keyword') ?? '';
        this.loadProducts();
      }),
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscriptions.unsubscribe();
    this.productsSubscription?.unsubscribe();
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }
  }

  toggleCategory(category: string, checked: boolean): void {
    if (checked) {
      this.selectedCategories.add(category);
    } else {
      this.selectedCategories.delete(category);
    }
    this.loadProducts();
  }

  selectPrice(index: number | null): void {
    this.selectedPriceIndex = index;
    this.loadProducts();
  }

  clearFilters(): void {
    this.selectedCategories.clear();
    this.selectedPriceIndex = null;
    this.loadProducts();
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
    this.showToast(`Đã thêm "${product.title}" vào giỏ hàng.`);
  }

  productPrice(product: Product): number {
    return Number(product.currentPrice);
  }

  productImage(product: Product): string {
    return product.imageUrl || 'https://placehold.co/300x400/e2e8f0/475569?text=AIMS';
  }

  mediaTypeLabel(mediaType: string): string {
    const labels: Record<string, string> = {
      BOOK: 'Sách',
      NEWSPAPER: 'Báo chí',
      CD: 'CD',
      DVD: 'DVD',
    };
    return labels[mediaType] ?? mediaType;
  }

  private loadProducts(): void {
    this.productsSubscription?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    const selectedCategories = Array.from(this.selectedCategories);
    const params = this.buildSearchParams(selectedCategories);
    const hasSearchParams = Boolean(
      params.keyword || params.minPrice !== undefined || params.maxPrice !== undefined || selectedCategories.length,
    );

    const request$ = !hasSearchParams
      ? this.productService.getRandomProducts()
      : this.productService.searchProducts(params);

    this.productsSubscription = request$
      .pipe(
        catchError(() => {
          this.errorMessage = 'Không thể tải danh sách sản phẩm. Hãy kiểm tra backend API.';
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
          this.refreshView();
        }),
      )
      .subscribe((products) => {
        this.products = products;
        this.refreshView();
      });
  }

  private buildSearchParams(mediaTypes: string[]): ProductSearchParams {
    const selectedPrice =
      this.selectedPriceIndex === null ? undefined : this.priceFilters[this.selectedPriceIndex];

    return {
      keyword: this.keyword,
      mediaTypes: mediaTypes.length ? mediaTypes : undefined,
      minPrice: selectedPrice?.minPrice,
      maxPrice: selectedPrice?.maxPrice,
    };
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }
    this.toastTimeoutId = setTimeout(() => {
      this.toastMessage = '';
      this.refreshView();
    }, 2500);
  }

  private refreshView(): void {
    if (!this.destroyed) {
      this.cdr.detectChanges();
    }
  }
}
