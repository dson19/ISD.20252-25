import { Body, Controller, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateVietqrPaymentDto } from '../dto/create-vietqr-payment.dto';
import { VietqrCallbackDto } from '../dto/vietqr-callback.dto';
import { PaymentService } from '../services/payment.service';

@Controller('api/vietqr/payments')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class VietqrController {
  constructor(private readonly paymentService: PaymentService) { }

  @Post()
  async createPayment(@Body() dto: CreateVietqrPaymentDto) {
    return await this.paymentService.createQrPayment(dto.orderId, dto.amount, dto.content);
  }

  @Get(':paymentId/status')
  async getStatusByPaymentId(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return await this.paymentService.getQrStatusByPaymentId(paymentId);
  }

  @Get('by-ref/:transactionRef/status')
  async getStatusByTransactionRef(@Param('transactionRef') transactionRef: string) {
    return await this.paymentService.getQrStatusByTransactionRef(transactionRef);
  }

  @Post(':paymentId/trigger-callback')
  async triggerTestCallback(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return await this.paymentService.triggerQrTestCallback(paymentId);
  }

  @Post('callback')
  async handleCallback(@Body() dto: VietqrCallbackDto) {
    return await this.paymentService.handleQrCallback(dto);
  }
}
