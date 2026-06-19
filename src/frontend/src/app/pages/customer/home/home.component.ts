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
    { label: 'Book', value: 'BOOK' },
    { label: 'CD', value: 'CD' },
    { label: 'DVD', value: 'DVD' },
    { label: 'Newspaper', value: 'NEWSPAPER' },
  ];

  priceFilters: PriceFilter[] = [
    { label: 'Under 100,000', maxPrice: 100000 },
    { label: '100,000 - 500,000', minPrice: 100000, maxPrice: 500000 },
    { label: '500,000 - 1,000,000', minPrice: 500000, maxPrice: 1000000 },
    { label: 'Over 1,000,000', minPrice: 1000000 },
  ];

  readonly batchSize = 20;
  products: Product[] = [];
  selectedCategories = new Set<string>();
  selectedPriceIndex: number | null = null;
  keyword = '';
  loading = false;
  errorMessage = '';
  toastMessage = '';
  visibleProductCount = this.batchSize;
  quantities: Record<number, number> = {};

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
        this.keyword = (params.get('keyword') ?? '').trim();
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
    const quantity = this.getProductQuantity(product);
    this.cartService.addToCart(product, quantity);
    this.showToast(`Added ${quantity} × "${product.title}" to cart.`);
  }

  get visibleProducts(): Product[] {
    return this.products.slice(0, this.visibleProductCount);
  }

  get displayedProductCount(): number {
    return Math.min(this.visibleProductCount, this.products.length);
  }

  get hasMoreProducts(): boolean {
    return this.visibleProductCount < this.products.length;
  }

  loadMoreProducts(): void {
    this.visibleProductCount += this.batchSize;
  }

  getProductQuantity(product: Product): number {
    return this.quantities[product.productID] ?? 1;
  }

  decreaseQuantity(product: Product): void {
    this.setProductQuantity(product, this.getProductQuantity(product) - 1);
  }

  increaseQuantity(product: Product): void {
    this.setProductQuantity(product, this.getProductQuantity(product) + 1);
  }

  updateQuantity(product: Product, value: number): void {
    this.setProductQuantity(product, value);
  }

  setProductQuantity(product: Product, value: number): void {
    const normalized = Number.isFinite(value) ? Math.floor(value) : 1;
    this.quantities[product.productID] = Math.max(1, normalized);
  }

  productPrice(product: Product): number {
    return Number(product.currentPrice);
  }

  originalPrice(product: Product): number {
    return Number(product.originalPrice);
  }

  hasOriginalPrice(product: Product): boolean {
    const originalPrice = this.originalPrice(product);
    return Number.isFinite(originalPrice) && originalPrice > this.productPrice(product);
  }

  productImage(product: Product): string {
    return product.imageUrl || 'https://placehold.co/300x400/e2e8f0/475569?text=AIMS';
  }

  mediaTypeLabel(mediaType: string): string {
    const labels: Record<string, string> = {
      BOOK: 'Book',
      NEWSPAPER: 'Newspaper',
      CD: 'CD',
      DVD: 'DVD',
    };
    return labels[mediaType] ?? mediaType;
  }

  private loadProducts(): void {
    this.productsSubscription?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    this.visibleProductCount = this.batchSize;
    const selectedCategories = Array.from(this.selectedCategories);
    const params = this.buildSearchParams(selectedCategories);
    const request$ = this.productService.searchProducts(params);

    this.productsSubscription = request$
      .pipe(
        catchError(() => {
          this.errorMessage = 'Unable to load products. Please try again later.';
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
          this.refreshView();
        }),
      )
      .subscribe((products) => {
        this.products = this.shuffleProducts(products);
        this.syncQuantities(products);
        this.refreshView();
      });
  }

  private buildSearchParams(mediaTypes: string[]): ProductSearchParams {
    const selectedPrice =
      this.selectedPriceIndex === null ? undefined : this.priceFilters[this.selectedPriceIndex];

    return {
      keyword: this.keyword.trim(),
      mediaTypes: mediaTypes.length ? mediaTypes : undefined,
      minPrice: selectedPrice?.minPrice,
      maxPrice: selectedPrice?.maxPrice,
    };
  }

  private syncQuantities(products: Product[]): void {
    const nextQuantities: Record<number, number> = {};
    for (const product of products) {
      nextQuantities[product.productID] = this.quantities[product.productID] ?? 1;
    }
    this.quantities = nextQuantities;
  }

  private shuffleProducts(products: Product[]): Product[] {
    const shuffledProducts = [...products];
    for (let index = shuffledProducts.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledProducts[index], shuffledProducts[randomIndex]] = [
        shuffledProducts[randomIndex],
        shuffledProducts[index],
      ];
    }
    return shuffledProducts;
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
