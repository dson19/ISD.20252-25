import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../app.config';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string,
  ) {}

  pay(orderId: number, amount: number, method: 'PAYPAL' | 'VIETQR', content?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/payment/pay`, { orderId, amount, method, content });
  }

  capture(paypalOrderID: string, orderId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/payment/capture`, { paypalOrderID, orderId });
  }

  refund(orderId: number, amount: number, method: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/payment/refund`, { orderId, amount, method });
  }

  getVietqrStatus(paymentId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/payment/${paymentId}/status`);
  }

  triggerVietqrTestCallback(paymentId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/payment/${paymentId}/trigger-callback`, {});
  }

  getOrderDetail(orderId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/orders/${orderId}`);
  }

  getCustomerOrderDetail(orderId: number, token: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/customer/orders/${orderId}?token=${encodeURIComponent(token)}`);
  }

  cancelOrder(orderId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/orders/${orderId}/cancel`, {});
  }

  cancelCustomerOrder(orderId: number, token: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/customer/orders/${orderId}/cancel?token=${encodeURIComponent(token)}`, {});
  }
}
