import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Invoice } from '../order/entities/invoice.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaypalTransaction } from './entities/paypal-transaction.entity';
import { VietqrTransaction } from './entities/vietqr-transaction.entity';
import { PaymentRepository } from './payment.repository';
import { PaypalRepository } from './paypal.repository';
import { PaypalService } from './paypal.service';
import { PaymentController } from './paypal.controller';
import { OrderModule } from '../order/order.module';
import { VietqrController } from './vietqr.controller';
import { VietqrApiClient } from './vietqr-api.client';
import { VietqrPaymentService } from './vietqr-payment.service';
import { VietqrRepository } from './vietqr.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Invoice, PaymentTransaction, PaypalTransaction, VietqrTransaction]),
    OrderModule,
  ],
  controllers: [PaymentController, VietqrController],
  providers: [
    PaymentRepository,
    PaypalRepository,
    PaypalService,
    VietqrRepository,
    VietqrApiClient,
    VietqrPaymentService,
  ],
  exports: [
    PaymentRepository,
    PaypalRepository,
    PaypalService,
    VietqrRepository,
    VietqrPaymentService,
  ],
})
export class PaymentModule { }
