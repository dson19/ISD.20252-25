import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { DeliveryInfo } from './entities/delivery-info.entity';
import { Invoice } from './entities/invoice.entity';
import { OrderRepository } from './order.repository';
import { ProductsModule } from '../product/product.module';
import { OrderController } from './order.controller';
import { CartService } from './services/cart.service';
import { OrderService } from './services/order.service';
import { ShippingCalculatorService } from './services/shipping-calculator.service';

@Module({
  imports: [
    ProductsModule,
    TypeOrmModule.forFeature([Order, OrderItem, DeliveryInfo, Invoice]),
  ],
  controllers: [OrderController],
  providers: [OrderRepository, CartService, OrderService, ShippingCalculatorService],
  exports: [OrderRepository, CartService, OrderService, ShippingCalculatorService],
})
export class OrderModule {}
