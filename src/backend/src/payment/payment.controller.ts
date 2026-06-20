import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentService } from './services/payment.service';
import { PaypalService } from './services/paypal.service';
import { VietqrPaymentService } from './services/vietqr-payment.service';

@Controller('api/payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paypalService: PaypalService,
    private readonly vietqrPaymentService: VietqrPaymentService,
  ) {}

  @Post('pay')
  @UseGuards(JwtAuthGuard)
  async pay(@Body() body: { orderId: number; amount: number; method: string; content?: string }): Promise<any> {
    return this.paymentService.processPayment(body.orderId, body.amount, body.method, body.content ? { content: body.content } : undefined);
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard)
  async refund(@Body() body: { orderId: number; amount: number; method: string }): Promise<any> {
    return this.paymentService.processRefund(body.orderId, body.amount, body.method);
  }

  @Post('capture')
  @UseGuards(JwtAuthGuard)
  async capture(@Body() body: { paypalOrderID: string; orderId: number }): Promise<any> {
    return this.paypalService.captureOrderInPaypal(body.paypalOrderID, body.orderId);
  }

  @Get(':paymentId/status')
  @UseGuards(JwtAuthGuard)
  async getVietqrStatus(@Param('paymentId', ParseIntPipe) paymentId: number): Promise<any> {
    return this.vietqrPaymentService.getStatusByPaymentId(paymentId);
  }

  @Post(':paymentId/trigger-callback')
  @UseGuards(JwtAuthGuard)
  async triggerVietqrCallback(@Param('paymentId', ParseIntPipe) paymentId: number): Promise<any> {
    return this.vietqrPaymentService.triggerTestCallback(paymentId);
  }
}
