import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:3001/api';

export interface VietqrPaymentResponse {
  paymentId: number;
  orderId: number;
  amount: number;
  transactionRef: string | null;
  content: string;
  paymentContent: string;
  qrCode: string | null;
  qrLink: string | null;
  expiredAt: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
}

export interface PaypalOrderResponse {
  paypalOrderID: string;
  status: string;
  approveUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(private http: HttpClient) {}

  createVietqrPayment(orderId: number, amount: number): Observable<VietqrPaymentResponse> {
    return this.http.post<VietqrPaymentResponse>(`${API_BASE_URL}/vietqr/payments`, {
      orderId,
      amount,
      content: `AIMS ${orderId}`,
    });
  }

  getVietqrStatus(paymentId: number): Observable<VietqrPaymentResponse> {
    return this.http.get<VietqrPaymentResponse>(`${API_BASE_URL}/vietqr/payments/${paymentId}/status`);
  }

  createPaypalOrder(orderId: number): Observable<PaypalOrderResponse> {
    return this.http.post<PaypalOrderResponse>(`${API_BASE_URL}/paypal/order/create`, {
      orderID: orderId,
    });
  }
}
