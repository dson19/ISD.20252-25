import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { OrderItemResponse, OrderResponse, OrderService } from '../../../services/order.service';

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './invoice.component.html',
})
export class InvoiceComponent implements OnInit, OnDestroy {
  order: OrderResponse | null = null;
  loading = true;
  errorMessage = '';

  private readonly subscriptions = new Subscription();
  private destroyed = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly orderService: OrderService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const orderId = Number(this.route.snapshot.queryParamMap.get('orderId'));
    if (!Number.isFinite(orderId) || orderId <= 0) {
      this.router.navigate(['/cart']);
      return;
    }

    this.subscriptions.add(
      this.orderService
        .getOrderDetail(orderId)
        .pipe(
          finalize(() => {
            this.loading = false;
            this.refreshView();
          }),
        )
        .subscribe({
          next: (order) => {
            this.order = order;
          },
          error: () => {
            this.errorMessage = 'Khong the tai hoa don. Vui long kiem tra backend API va thu lai.';
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscriptions.unsubscribe();
  }

  get orderItems(): OrderItemResponse[] {
    return this.order?.orderItems ?? [];
  }

  get subtotal(): number {
    return Number(this.order?.invoice?.totalExcludeVAT ?? this.order?.subTotal ?? 0);
  }

  get totalIncludeVAT(): number {
    return Number(this.order?.invoice?.totalIncludeVAT ?? this.subtotal + Number(this.order?.tax ?? 0));
  }

  get shippingFee(): number {
    return Number(this.order?.invoice?.shippingFee ?? this.order?.shippingFee ?? 0);
  }

  get totalPayment(): number {
    return Number(this.order?.invoice?.totalPayment ?? this.order?.totalPayment ?? 0);
  }

  itemTotal(item: OrderItemResponse): number {
    return Number(item.unitPrice) * item.quantity;
  }

  proceedToPayment(): void {
    if (!this.order) {
      return;
    }

    this.router.navigate(['/payment'], {
      queryParams: {
        orderId: this.order.orderID,
        amount: this.totalPayment,
      },
    });
  }

  private refreshView(): void {
    if (!this.destroyed) {
      this.cdr.detectChanges();
    }
  }
}
