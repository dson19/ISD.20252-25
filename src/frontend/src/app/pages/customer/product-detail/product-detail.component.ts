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
  product: Product | null = null;
  selectedQuantity = 1;
  showFullDescription = false;
  showAllTracks = false;
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
          this.selectedQuantity = this.clampQuantity(this.selectedQuantity);
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
    if (!this.product || this.isOutOfStock || this.quantityInvalid) {
      return;
    }

    const quantity = this.clampQuantity(this.selectedQuantity);
    this.cartService.addToCart(this.product, quantity);
    this.showToast(`Đã thêm ${quantity} sản phẩm vào giỏ hàng.`);
  }

  increaseQuantity(): void {
    if (!this.product) {
      return;
    }

    this.selectedQuantity = this.clampQuantity(this.selectedQuantity + 1);
  }

  decreaseQuantity(): void {
    this.selectedQuantity = this.clampQuantity(this.selectedQuantity - 1);
  }

  setSelectedQuantity(quantity: number | null): void {
    this.selectedQuantity = this.clampQuantity(Number(quantity));
  }

  get maxSelectableQuantity(): number {
    return Math.max(0, Math.floor(Number(this.product?.quantityInStock ?? 0)));
  }

  get isOutOfStock(): boolean {
    return this.maxSelectableQuantity <= 0;
  }

  get canDecreaseQuantity(): boolean {
    return !this.isOutOfStock && this.selectedQuantity > 1;
  }

  get canIncreaseQuantity(): boolean {
    return !this.isOutOfStock && this.selectedQuantity < this.maxSelectableQuantity;
  }

  get quantityInvalid(): boolean {
    if (!this.product) {
      return true;
    }

    return (
      this.isOutOfStock ||
      !Number.isFinite(this.selectedQuantity) ||
      this.selectedQuantity < 1 ||
      Math.floor(this.selectedQuantity) !== this.selectedQuantity ||
      this.selectedQuantity > this.maxSelectableQuantity
    );
  }

  get quantityErrorMessage(): string {
    if (!this.product) {
      return '';
    }

    if (this.isOutOfStock) {
      return 'Sản phẩm đã hết hàng.';
    }

    if (!Number.isFinite(this.selectedQuantity) || this.selectedQuantity < 1) {
      return 'Số lượng phải lớn hơn hoặc bằng 1.';
    }

    if (Math.floor(this.selectedQuantity) !== this.selectedQuantity) {
      return 'Số lượng phải là số nguyên.';
    }

    if (this.selectedQuantity > this.maxSelectableQuantity) {
      return `Số lượng yêu cầu vượt quá tồn kho. Hiện chỉ còn ${this.maxSelectableQuantity} sản phẩm.`;
    }

    return '';
  }

  get quantityLimitMessage(): string {
    if (!this.product || this.quantityErrorMessage) {
      return '';
    }

    if (this.maxSelectableQuantity === 1) {
      return 'Chỉ còn 1 sản phẩm trong kho.';
    }

    if (!this.canIncreaseQuantity) {
      return `Đã chọn tối đa ${this.maxSelectableQuantity} sản phẩm có thể mua.`;
    }

    return '';
  }

  get descriptionText(): string {
    return this.product?.description?.trim() || 'Chưa có mô tả.';
  }

  get shouldCollapseDescription(): boolean {
    return this.descriptionText.length > 260;
  }

  get displayedDescription(): string {
    if (!this.shouldCollapseDescription || this.showFullDescription) {
      return this.descriptionText;
    }

    return `${this.descriptionText.slice(0, 260).trim()}...`;
  }

  get visibleCdTracks() {
    const tracks = this.product?.cd?.tracks ?? [];
    return this.showAllTracks ? tracks : tracks.slice(0, 8);
  }

  get shouldCollapseTracks(): boolean {
    return (this.product?.cd?.tracks?.length ?? 0) > 8;
  }

  productPrice(): number {
    return Number(this.product?.currentPrice ?? 0);
  }

  productImage(): string {
    return this.product?.imageUrl || 'https://placehold.co/500x650/e2e8f0/475569?text=AIMS';
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

  mediaTypeLabel(mediaType: string): string {
    const labels: Record<string, string> = {
      BOOK: 'Sách',
      NEWSPAPER: 'Báo chí',
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

  private clampQuantity(quantity: number): number {
    const safeQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
    const maxQuantity = Math.max(1, this.maxSelectableQuantity);
    return Math.min(Math.max(1, safeQuantity), maxQuantity);
  }
}
