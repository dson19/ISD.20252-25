import { forwardRef, Module } from '@nestjs/common';
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
import { NotificationModule } from '../notification/notification.module';
import { PaypalAdapter } from './adapters/paypal-adapter';
import { VietqrAdapter } from './adapters/vietqr-adapter';
import { PaymentService } from './services/payment.service';
import { PAYMENT_ADAPTERS } from './interfaces/payment-adapter.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Invoice, PaymentTransaction, PaypalTransaction, VietqrTransaction]),
    forwardRef(() => OrderModule),
    NotificationModule,
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
    PaypalAdapter,
    VietqrAdapter,
    // OCP: register every adapter under one token so PaymentService discovers them dynamically.
    // Adding a gateway (VNPay/MoMo) = add its adapter here, no change to PaymentService.
    {
      provide: PAYMENT_ADAPTERS,
      useFactory: (paypal: PaypalAdapter, vietqr: VietqrAdapter) => [paypal, vietqr],
      inject: [PaypalAdapter, VietqrAdapter],
    },
    PaymentService,
  ],
  exports: [
    PaymentRepository,
    PaypalRepository,
    PaypalService,
    PaypalApiClient,
    VietqrRepository,
    VietqrApiClient,
    VietqrPaymentService,
    PaypalAdapter,
    VietqrAdapter,
    PaymentService,
  ],
})
/**
 * + Coupling/Cohesion level:
 *   - Common Coupling: PaymentModule registers shared services and configurations inside the NestJS container.
 *   - Temporal Cohesion: Resolves and instantiates registered singletons during NestJS boot time.
 * + Reason why:
 *   - Centrally configuring and bootstrapping services prevents scattered instantiation logic, keeping system modules separated.
 */
export class PaymentModule { }
