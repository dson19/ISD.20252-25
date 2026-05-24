import { Body, Controller, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateVietqrPaymentDto } from './dto/create-vietqr-payment.dto';
import { VietqrCallbackDto } from './dto/vietqr-callback.dto';
import { VietqrPaymentService } from './vietqr-payment.service';

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrPaymentService because it passes validated DTOs and scalar route parameters only.
 * - Avoids Control Coupling by exposing VietQR-specific endpoints without payment gateway dispatch flags.
 * - Avoids Stamp Coupling by not passing request objects, Order objects, or Cart objects into the service.
 *
 * Cohesion:
 * - Functional Cohesion because this class only handles VietQR HTTP endpoints for PayOrder.
 *
 * Reason:
 * - Keeping HTTP validation and routing here prevents controller logic from mixing with API calls or database updates.
 *
 * Improvement Direction:
 * - Add authentication/authorization guards if payment endpoints are secured later.
 */
@Controller('api/vietqr/payments')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class VietqrController {
  constructor(private readonly vietqrPaymentService: VietqrPaymentService) {}

  @Post()
  async createPayment(@Body() dto: CreateVietqrPaymentDto) {
    return await this.vietqrPaymentService.createPayment(dto);
  }

  @Get(':paymentId/status')
  async getStatusByPaymentId(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return await this.vietqrPaymentService.getStatusByPaymentId(paymentId);
  }

  @Get('by-ref/:transactionRef/status')
  async getStatusByTransactionRef(@Param('transactionRef') transactionRef: string) {
    return await this.vietqrPaymentService.getStatusByTransactionRef(transactionRef);
  }

  @Post('callback')
  async handleCallback(@Body() dto: VietqrCallbackDto) {
    return await this.vietqrPaymentService.handleCallback(dto);
  }
}
