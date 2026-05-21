import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Invoice } from '../order/entities/invoice.entity';
import { PaymentRepository } from './payment.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Invoice])],
  controllers: [],
  providers: [PaymentRepository],
  exports: [PaymentRepository],
})
export class PaymentModule {}
