import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateVietqrPaymentDto } from '../dto/create-vietqr-payment.dto';
import { VietqrCallbackDto } from '../dto/vietqr-callback.dto';
import { VietqrPaymentService } from '../services/vietqr-payment.service';

@Controller('api/vietqr/payments')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class VietqrController {
  constructor(private readonly vietqrPaymentService: VietqrPaymentService) { }

  @Post()
  async createPayment(@Body() dto: CreateVietqrPaymentDto) {
    return await this.vietqrPaymentService.createPayment(dto);
  }

  @Get(':paymentId/status')
  async getStatusByPaymentId(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Query('simulate') simulate?: string,
  ) {
    return await this.vietqrPaymentService.getStatusByPaymentId(paymentId, simulate === 'true');
  }

  @Get('by-ref/:transactionRef/status')
  async getStatusByTransactionRef(
    @Param('transactionRef') transactionRef: string,
    @Query('simulate') simulate?: string,
  ) {
    return await this.vietqrPaymentService.getStatusByTransactionRef(transactionRef, simulate === 'true');
  }

  @Post('callback')
  async handleCallback(@Body() dto: VietqrCallbackDto) {
    return await this.vietqrPaymentService.handleCallback(dto);
  }
}
