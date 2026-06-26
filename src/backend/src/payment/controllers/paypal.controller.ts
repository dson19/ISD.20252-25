// src/payments/payments.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { CreatePaypalOrderDto } from '../dto/create-paypal-order.dto';
import { CapturePaypalOrderDto } from '../dto/capture-paypal-order.dto';
import { RefundOrderDto } from '../dto/refund-paypal-order.dto';

@Controller('api/paypal/order')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) { }

  @Post('create')
  async createOrder(@Body() dto: CreatePaypalOrderDto) {
    return await this.paymentService.createCreditCardOrder(dto.orderID);
  }

  @Post('capture')
  async captureOrder(@Body() dto: CapturePaypalOrderDto) {
    return await this.paymentService.captureCreditCardOrder(dto.paypalOrderID, dto.orderID);
  }

  @Post('refund')
  async refundOrder(@Body() dto: RefundOrderDto) {
    return await this.paymentService.processRefund(dto.orderID);
  }
}
