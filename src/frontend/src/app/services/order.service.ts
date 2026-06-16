import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CartItem } from './cart.service';
import { API_BASE_URL } from '../app.config';

export interface DeliveryInfo {
  receiverName: string;
  email: string;
  phoneNumber: string;
  address: string;
  province: string;
  deliveryNotes?: string;
}

export interface StockIssue {
  productId: number;
  requestedQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  reason?: string;
}

export interface StockCheckResponse {
  available: boolean;
  issues: StockIssue[];
}

export interface OrderResponse {
  orderID: number;
  totalPayment: number | string;
  subTotal: number | string;
  tax: number | string;
  shippingFee: number | string;
  status: string;
  orderItems?: OrderItemResponse[];
  deliveryInfo?: DeliveryInfo;
  invoice?: InvoiceResponse;
}

export interface OrderItemResponse {
  quantity: number;
  unitPrice: number | string;
  product?: {
    productID: number;
    title: string;
    currentPrice: number | string;
    imageUrl?: string | null;
    productType?: string;
    mediaType?: string;
    quantityInStock?: number;
  };
}

export interface InvoiceResponse {
  totalExcludeVAT: number | string;
  totalIncludeVAT: number | string;
  shippingFee: number | string;
  totalPayment: number | string;
}

export interface ShippingFeeResponse {
  subtotal: number;
  tax: number;
  shippingFee: number;
  totalPayment: number;
}

export interface OrderListFilters {
  search?: string;
  dateRange?: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
  paymentMethod?: 'ALL' | 'PAYPAL' | 'VIETQR' | 'UNPAID';
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(
    private http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string
  ) {}

  checkCartStock(cartItems: CartItem[]): Observable<StockCheckResponse> {
    return this.http.post<StockCheckResponse>(`${this.baseUrl}/api/orders/cart/check-stock`, {
      cartItems: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    });
  }

  placeOrder(cartItems: CartItem[], deliveryInfo: DeliveryInfo): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.baseUrl}/api/orders`, {
      cartItems: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
      deliveryInfo,
    });
  }

  updateDeliveryInfo(orderId: number, deliveryInfo: DeliveryInfo): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.baseUrl}/api/orders/${orderId}/delivery-info`, deliveryInfo);
  }

  calculateShippingFee(cartItems: CartItem[], province: string): Observable<ShippingFeeResponse> {
    return this.http.post<ShippingFeeResponse>(`${this.baseUrl}/api/orders/shipping-fee`, {
      province,
      cartItems: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    });
  }

  getOrderDetail(orderId: number): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.baseUrl}/api/orders/${orderId}`);
  }

  getPendingOrders(page: number, limit: number, filters: OrderListFilters = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/orders/pending`, {
      params: this.buildOrderListParams(page, limit, filters),
    });
  }

  getVietqrRefunds(page: number, limit: number, filters: OrderListFilters = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/orders/vietqr-refunds`, {
      params: this.buildOrderListParams(page, limit, filters),
    });
  }

  confirmVietqrRefund(orderId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/orders/${orderId}/confirm-vietqr-refund`, {});
  }

  approveOrder(orderId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/orders/${orderId}/approve`, {});
  }

  rejectOrder(orderId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/orders/${orderId}/reject`, {});
  }

  cancelOrder(orderId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/orders/${orderId}/cancel`, {});
  }

  private buildOrderListParams(page: number, limit: number, filters: OrderListFilters): HttpParams {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    const search = filters.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (filters.dateRange && filters.dateRange !== 'ALL') {
      params = params.set('dateRange', filters.dateRange);
    }
    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      params = params.set('paymentMethod', filters.paymentMethod);
    }

    return params;
  }
}
