import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string
  ) { }

  createOrder(orderId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/paypal/order/create`, {
      orderID: orderId
    });
  }

  captureOrder(paypalOrderID: string, orderId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/paypal/order/capture`, {
      paypalOrderID,
      orderID: orderId
    });
  }
  getOrderDetail(orderId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/orders/${orderId}`);
  }

  getCustomerOrderDetail(orderId: number, token: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/customer/orders/${orderId}?token=${encodeURIComponent(token)}`);
  }

  refundOrder(orderId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/paypal/order/refund`, {
      orderID: orderId
    });
  }

  cancelOrder(orderId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/orders/${orderId}/cancel`, {});
  }

  cancelCustomerOrder(orderId: number, token: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/customer/orders/${orderId}/cancel?token=${encodeURIComponent(token)}`, {});
  }

  createVietqrPayment(orderId: number, amount: number, content: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/vietqr/payments`, {
      orderId,
      amount,
      content
    });
  }

  getVietqrPaymentStatus(paymentId: number, simulate = false): Observable<any> {
    const url = simulate
      ? `${this.baseUrl}/api/vietqr/payments/${paymentId}/status?simulate=true`
      : `${this.baseUrl}/api/vietqr/payments/${paymentId}/status`;
    return this.http.get(url);
  }
}
