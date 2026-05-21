import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/orderItem.entity';
import { DeliveryInfo } from './entities/deliveryInfo.entity';
import { Invoice } from './entities/invoice.entity';
import { OrderRepository } from './order.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, DeliveryInfo, Invoice]),
  ],
  controllers: [],
  providers: [OrderRepository],
  exports: [OrderRepository],
})
export class OrderModule {}
