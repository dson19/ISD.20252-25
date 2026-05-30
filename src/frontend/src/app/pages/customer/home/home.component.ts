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
  readonly productsPageSize = 20;

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
  visibleProductCount = this.productsPageSize;
  productQuantities: Record<number, number> = {};
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
    if (product.quantityInStock <= 0) {
      return;
    }

    const quantity = this.quantityFor(product);
    this.cartService.addToCart(product, quantity);
    this.showToast(`Đã thêm ${quantity} sản phẩm "${product.title}" vào giỏ hàng.`);
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

  quantityFor(product: Product): number {
    const selectedQuantity = this.productQuantities[product.productID] ?? 1;
    return this.clampProductQuantity(product, selectedQuantity);
  }

  updateProductQuantity(product: Product, quantity: number | null): void {
    this.productQuantities[product.productID] = this.clampProductQuantity(product, Number(quantity));
  }

  increaseProductQuantity(product: Product): void {
    this.updateProductQuantity(product, this.quantityFor(product) + 1);
  }

  decreaseProductQuantity(product: Product): void {
    this.updateProductQuantity(product, this.quantityFor(product) - 1);
  }

  get visibleProducts(): Product[] {
    return this.products.slice(0, this.visibleProductCount);
  }

  get visibleProductsCount(): number {
    return Math.min(this.visibleProductCount, this.products.length);
  }

  get canShowMoreProducts(): boolean {
    return this.visibleProductsCount < this.products.length;
  }

  showMoreProducts(): void {
    this.visibleProductCount = Math.min(
      this.visibleProductCount + this.productsPageSize,
      this.products.length,
    );
  }

  private loadProducts(): void {
    this.productsSubscription?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    const selectedCategories = Array.from(this.selectedCategories);
    const params = this.buildSearchParams(selectedCategories);
    const request$ = this.productService.searchProducts(params);

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
        this.reconcileProductQuantities();
        this.visibleProductCount = this.productsPageSize;
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

  private clampProductQuantity(product: Product, quantity: number): number {
    const safeQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
    const maxQuantity = Math.max(1, product.quantityInStock);
    return Math.min(Math.max(1, safeQuantity), maxQuantity);
  }

  private reconcileProductQuantities(): void {
    const nextQuantities: Record<number, number> = {};
    for (const product of this.products) {
      nextQuantities[product.productID] = this.quantityFor(product);
    }
    this.productQuantities = nextQuantities;
  }
}
