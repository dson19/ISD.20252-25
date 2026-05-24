import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Invoice } from '../order/entities/invoice.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaypalTransaction } from './entities/paypal-transaction.entity';
import { PaymentRepository } from './payment.repository';
import { PaypalRepository } from './paypal.repository';
import { PaypalService } from './paypal.service';
import { PaymentController } from './paypal.controller';
import { OrderModule } from '../order/order.module';
import { PaypalApiClient } from './paypal-api-client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Invoice, PaymentTransaction, PaypalTransaction]),
    OrderModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentRepository,
    PaypalRepository,
    PaypalService,
    PaypalApiClient,
  ],
  exports: [
    PaymentRepository,
    PaypalRepository,
    PaypalService,
    PaypalApiClient,
  ],
})
export class PaymentModule { }
