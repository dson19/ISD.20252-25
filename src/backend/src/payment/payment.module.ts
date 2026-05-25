import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Invoice } from '../order/entities/invoice.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaypalTransaction } from './entities/paypal-transaction.entity';
import { VietqrTransaction } from './entities/vietqr-transaction.entity';
import { PaymentRepository } from './repositories/payment.repository';
import { PaypalRepository } from './repositories/paypal.repository';
import { PaypalService } from './services/paypal.service';
import { PaymentController } from './controllers/paypal.controller';
import { OrderModule } from '../order/order.module';
import { VietqrController } from './controllers/vietqr.controller';
import { VietqrMerchantController } from './controllers/vietqr-merchant.controller';
import { VietqrApiClient } from './API/vietqr-api.client';
import { VietqrPaymentService } from './services/vietqr-payment.service';
import { VietqrRepository } from './repositories/vietqr.repository';
import { PaypalApiClient } from './API/paypal-api-client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Invoice, PaymentTransaction, PaypalTransaction, VietqrTransaction]),
    OrderModule,
  ],
  controllers: [PaymentController, VietqrController, VietqrMerchantController],
  providers: [
    PaymentRepository,
    PaypalRepository,
    PaypalService,
    PaypalApiClient,
    VietqrRepository,
    VietqrApiClient,
    VietqrPaymentService,
  ],
  exports: [
    PaymentRepository,
    PaypalRepository,
    PaypalService,
    PaypalApiClient,
    VietqrRepository,
    VietqrApiClient,
    VietqrPaymentService,
  ],
})
export class PaymentModule { }
