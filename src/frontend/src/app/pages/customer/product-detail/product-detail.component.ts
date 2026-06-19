import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../../../services/cart.service';
import { Product, ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-detail.component.html'
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  readonly descriptionPreviewLength = 260;
  product: Product | null = null;
  selectedQuantity = 1;
  descriptionExpanded = false;
  loading = true;
  errorMessage = '';
  toastMessage = '';

  private readonly subscriptions = new Subscription();
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const productId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(productId)) {
      this.loading = false;
      this.errorMessage = 'Invalid product ID.';
      this.refreshView();
      return;
    }

    this.subscriptions.add(
      this.productService.getProductById(productId).subscribe({
        next: (product) => {
          this.product = product;
          this.descriptionExpanded = false;
          this.loading = false;
          this.refreshView();
        },
        error: () => {
          this.errorMessage = 'Unable to load product details.';
          this.loading = false;
          this.refreshView();
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscriptions.unsubscribe();
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }
  }

  addToCart(): void {
    if (!this.product || this.quantityInvalid) {
      return;
    }

    const quantity = this.normalizedQuantity();
    this.cartService.addToCart(this.product, quantity);
    this.showToast(`Added ${quantity} item(s) to cart.`);
  }

  decreaseQuantity(): void {
    this.selectedQuantity = Math.max(1, this.normalizedQuantity() - 1);
  }

  increaseQuantity(): void {
    this.selectedQuantity = this.normalizedQuantity() + 1;
  }

  updateQuantity(value: number): void {
    this.selectedQuantity = value;
  }

  toggleDescription(): void {
    this.descriptionExpanded = !this.descriptionExpanded;
  }

  get quantityInvalid(): boolean {
    return (
      !Number.isFinite(this.selectedQuantity) ||
      this.selectedQuantity < 1 ||
      Math.floor(this.selectedQuantity) !== this.selectedQuantity
    );
  }

  get quantityErrorMessage(): string {
    if (!Number.isFinite(this.selectedQuantity) || this.selectedQuantity < 1) {
      return 'Quantity must be at least 1.';
    }

    if (Math.floor(this.selectedQuantity) !== this.selectedQuantity) {
      return 'Quantity must be a whole number.';
    }

    return '';
  }

  get productDescription(): string {
    return this.product?.description?.trim() || 'No description available.';
  }

  get shouldCollapseDescription(): boolean {
    return this.productDescription.length > this.descriptionPreviewLength;
  }

  get visibleDescription(): string {
    if (!this.shouldCollapseDescription || this.descriptionExpanded) {
      return this.productDescription;
    }

    return `${this.productDescription.slice(0, this.descriptionPreviewLength).trimEnd()}...`;
  }

  productPrice(): number {
    return Number(this.product?.currentPrice ?? 0);
  }

  originalPrice(): number {
    return Number(this.product?.originalPrice ?? 0);
  }

  hasOriginalPrice(): boolean {
    const originalPrice = this.originalPrice();
    return Number.isFinite(originalPrice) && originalPrice > this.productPrice();
  }

  productImage(): string {
    return this.product?.imageUrl || 'https://placehold.co/500x650/e2e8f0/475569?text=AIMS';
  }

  dimensions(): string {
    if (!this.product) {
      return 'N/A';
    }

    const values = [this.product.length, this.product.width, this.product.height]
      .filter((value): value is number => value !== null && value !== undefined);
    return values.length ? `${values.join(' x ')} cm` : 'N/A';
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'N/A';
    }
    return new Intl.DateTimeFormat('en-US').format(new Date(value));
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

  trackLength(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private normalizedQuantity(): number {
    return Math.max(1, Math.floor(Number(this.selectedQuantity) || 1));
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
