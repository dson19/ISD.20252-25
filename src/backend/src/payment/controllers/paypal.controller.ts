// src/payments/payments.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { PaypalService } from '../services/paypal.service';
import { CreatePaypalOrderDto } from '../dto/create-paypal-order.dto';
import { CapturePaypalOrderDto } from '../dto/capture-paypal-order.dto';
import { RefundOrderDto } from '../dto/refund-paypal-order.dto';

@Controller('api/paypal/order')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class PaymentController {
  constructor(private readonly paypalService: PaypalService) { }

  @Post('create')
  async createOrder(@Body() dto: CreatePaypalOrderDto) {
    return await this.paypalService.createOrderInPaypal(dto.orderID);
  }

  @Post('capture')
  async captureOrder(@Body() dto: CapturePaypalOrderDto) {
    return await this.paypalService.captureOrderInPaypal(dto.paypalOrderID, dto.orderID);
  }

  @Post('refund')
  async refundOrder(@Body() dto: RefundOrderDto) {
    return await this.paypalService.refundOrderInPaypal(dto.orderID);
  }
}