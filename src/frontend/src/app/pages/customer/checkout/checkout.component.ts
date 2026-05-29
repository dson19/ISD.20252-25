import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { CartItem, CartService } from '../../../services/cart.service';
import { DeliveryInfo, OrderResponse, OrderService, StockIssue } from '../../../services/order.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.component.html'
})
export class CheckoutComponent implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  editOrderId: number | null = null;
  shippingFee = 35000;
  calculatingShipping = false;
  submitting = false;
  loadingOrder = false;
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
  private readonly subscriptions = new Subscription();
  private destroyed = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.cartItems = this.cartService.getCartItems();
    this.cartSubscription = this.cartService.items$.subscribe((items) => {
      if (this.editOrderId) {
        return;
      }

      this.cartItems = items;
      this.calculateShippingFee();
    });
  }

  ngOnInit(): void {
    const orderId = Number(this.route.snapshot.queryParamMap.get('orderId'));
    if (Number.isFinite(orderId) && orderId > 0) {
      this.loadOrderForEditing(orderId);
      return;
    }

    this.calculateShippingFee();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cartSubscription.unsubscribe();
    this.activeShippingRequest?.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  get subtotal(): number {
    return this.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
    this.refreshView();
    this.activeShippingRequest = this.orderService
      .calculateShippingFee(this.cartItems, this.deliveryInfo.province)
      .pipe(
        finalize(() => {
          this.calculatingShipping = false;
          this.refreshView();
        }),
      )
      .subscribe({
        next: (result) => {
          this.shippingFee = Number(result.shippingFee);
        },
        error: () => {
          this.shippingError = 'Khong the tinh phi van chuyen. Vui long thu lai.';
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

    const request$ = this.editOrderId
      ? this.orderService.updateDeliveryInfo(this.editOrderId, this.deliveryInfo)
      : this.orderService.placeOrder(this.cartItems, this.deliveryInfo);

    request$.subscribe({
      next: (order) => {
        if (!this.editOrderId) {
          this.cartService.clearCart();
        }
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

  private loadOrderForEditing(orderId: number): void {
    this.editOrderId = orderId;
    this.loadingOrder = true;
    this.errorMessage = '';

    this.subscriptions.add(
      this.orderService.getOrderDetail(orderId).subscribe({
        next: (order) => {
          this.applyOrderForEditing(order);
          this.loadingOrder = false;
          this.calculateShippingFee();
          this.refreshView();
        },
        error: () => {
          this.loadingOrder = false;
          this.errorMessage = 'Khong the tai thong tin don hang de chinh sua.';
          this.refreshView();
        },
      }),
    );
  }

  private applyOrderForEditing(order: OrderResponse): void {
    this.deliveryInfo = {
      receiverName: order.deliveryInfo?.receiverName ?? '',
      email: order.deliveryInfo?.email ?? '',
      phoneNumber: order.deliveryInfo?.phoneNumber ?? '',
      province: order.deliveryInfo?.province ?? '',
      address: order.deliveryInfo?.address ?? '',
      deliveryNotes: order.deliveryInfo?.deliveryNotes ?? '',
    };
    this.shippingFee = Number(order.invoice?.shippingFee ?? order.shippingFee ?? 0);
    this.cartItems = (order.orderItems ?? []).map((item) => ({
      id: item.product?.productID ?? 0,
      title: item.product?.title ?? 'San pham',
      price: Number(item.unitPrice),
      imageUrl: item.product?.imageUrl || 'https://placehold.co/300x400/e2e8f0/475569?text=AIMS',
      quantity: item.quantity,
      mediaType: item.product?.mediaType ?? 'PRODUCT',
      quantityInStock: item.product?.quantityInStock ?? item.quantity,
    }));
  }

  private refreshView(): void {
    if (!this.destroyed) {
      this.cdr.detectChanges();
    }
  }
}
