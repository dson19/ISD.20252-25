import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../../../services/cart.service';
import { getProductType, Product, ProductService, productTypeLabel } from '../../../services/product.service';

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
      this.errorMessage = 'Mã sản phẩm không hợp lệ.';
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
          this.errorMessage = 'Không thể tải chi tiết sản phẩm.';
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
    this.showToast(`Đã thêm ${quantity} sản phẩm vào giỏ hàng.`);
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
      return 'Số lượng phải lớn hơn hoặc bằng 1.';
    }

    if (Math.floor(this.selectedQuantity) !== this.selectedQuantity) {
      return 'Số lượng phải là số nguyên.';
    }

    return '';
  }

  get productDescription(): string {
    return this.product?.description?.trim() || 'Chưa có mô tả.';
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

  productType(): string {
    return getProductType(this.product);
  }

  dimensions(): string {
    if (!this.product) {
      return 'Không có';
    }

    const values = [this.product.length, this.product.width, this.product.height]
      .filter((value): value is number => value !== null && value !== undefined);
    return values.length ? `${values.join(' x ')} cm` : 'Không có';
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'Không có';
    }
    return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
  }

  mediaTypeLabel(mediaType?: string | null): string {
    return productTypeLabel(mediaType);
  }

  trackLength(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  bookPublisher(): string {
    return this.valueOrEmpty(this.product?.book?.publisher ?? this.product?.book?.media?.publisher);
  }

  bookReleaseDate(): string {
    return this.formatDate(
      this.product?.book?.publicationDate ??
        this.product?.book?.releaseDate ??
        this.product?.book?.media?.releaseDate,
    );
  }

  bookPageCount(): string {
    return this.valueOrEmpty(this.product?.book?.numPages ?? this.product?.book?.numberOfPages);
  }

  bookLanguage(): string {
    return this.valueOrEmpty(this.product?.book?.language ?? this.product?.book?.media?.language);
  }

  bookGenre(): string {
    return this.valueOrEmpty(this.product?.book?.genre ?? this.product?.book?.media?.genre);
  }

  newspaperPublisher(): string {
    return this.valueOrEmpty(
      this.product?.newspaper?.publisher ?? this.product?.newspaper?.media?.publisher,
    );
  }

  newspaperReleaseDate(): string {
    return this.formatDate(
      this.product?.newspaper?.publicationDate ??
        this.product?.newspaper?.releaseDate ??
        this.product?.newspaper?.media?.releaseDate,
    );
  }

  newspaperFrequency(): string {
    return this.valueOrEmpty(
      this.product?.newspaper?.frequency ?? this.product?.newspaper?.publicationFrequency,
    );
  }

  cdPublisher(): string {
    return this.valueOrEmpty(
      this.product?.cd?.recordLabel ?? this.product?.cd?.publisher ?? this.product?.cd?.media?.publisher,
    );
  }

  cdGenre(): string {
    return this.valueOrEmpty(this.product?.cd?.genre ?? this.product?.cd?.media?.genre);
  }

  cdReleaseDate(): string {
    return this.formatDate(this.product?.cd?.releaseDate ?? this.product?.cd?.media?.releaseDate);
  }

  dvdRuntime(): string {
    const runtime = this.product?.dvd?.runtimeMinutes ?? this.product?.dvd?.runtime;
    return runtime ? `${runtime} phút` : 'Không có';
  }

  dvdPublisher(): string {
    return this.valueOrEmpty(
      this.product?.dvd?.studio ?? this.product?.dvd?.publisher ?? this.product?.dvd?.media?.publisher,
    );
  }

  dvdLanguage(): string {
    return this.valueOrEmpty(this.product?.dvd?.language ?? this.product?.dvd?.media?.language);
  }

  dvdGenre(): string {
    return this.valueOrEmpty(this.product?.dvd?.genre ?? this.product?.dvd?.media?.genre);
  }

  dvdReleaseDate(): string {
    return this.formatDate(this.product?.dvd?.releaseDate ?? this.product?.dvd?.media?.releaseDate);
  }

  private normalizedQuantity(): number {
    return Math.max(1, Math.floor(Number(this.selectedQuantity) || 1));
  }

  private valueOrEmpty(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return 'Không có';
    }

    return String(value);
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
