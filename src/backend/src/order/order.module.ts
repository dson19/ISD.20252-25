import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { DeliveryInfo } from './entities/delivery-info.entity';
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
