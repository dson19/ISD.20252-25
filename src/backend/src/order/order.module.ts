import { forwardRef, Module } from '@nestjs/common';
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
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { CustomerOrderController } from './customer-order.controller';

@Module({
  imports: [
    ProductsModule,
    NotificationModule,
    forwardRef(() => PaymentModule),
    TypeOrmModule.forFeature([Order, OrderItem, DeliveryInfo, Invoice]),
  ],
  controllers: [OrderController, CustomerOrderController],
  providers: [OrderRepository, CartService, OrderService, ShippingCalculatorService],
  exports: [OrderRepository, CartService, OrderService, ShippingCalculatorService],
})
export class OrderModule {}
