import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CartItem } from './cart.service';

const API_BASE_URL = 'http://localhost:3000/api';

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
  totalAmount: number | string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private http: HttpClient) {}

  checkCartStock(cartItems: CartItem[]): Observable<StockCheckResponse> {
    return this.http.post<StockCheckResponse>(`${API_BASE_URL}/orders/cart/check-stock`, {
      cartItems: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    });
  }

  placeOrder(cartItems: CartItem[], deliveryInfo: DeliveryInfo): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${API_BASE_URL}/orders`, {
      cartItems: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
      deliveryInfo,
    });
  }
}
