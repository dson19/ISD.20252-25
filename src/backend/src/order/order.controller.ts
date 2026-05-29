import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CheckCartStockDto } from './dto/check-cart-stock.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { ShippingFeeDto } from './dto/shipping-fee.dto';
import { CartService } from './services/cart.service';
import { OrderService } from './services/order.service';

/**
 * OrderController - REST API cho cart va quy trinh dat/duyet/huy don hang.
 *
 * COHESION: Functional Cohesion
 * Controller chi xu ly HTTP routing, validation boundary, va uy thac nghiep vu cho service.
 *
 * COUPLING: Low Data Coupling
 * Controller truyen DTO da validate vao service, khong truyen request object hay entity lon.
 */
@Controller('api/orders')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OrderController {
  constructor(
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
  ) {}

  @Post('cart/check-stock')
  async checkCartStock(@Body() dto: CheckCartStockDto) {
    return this.cartService.checkCartStock(dto.cartItems);
  }

  @Post('shipping-fee')
  async calculateShippingFee(@Body() dto: ShippingFeeDto) {
    return this.orderService.calculateShippingFee(dto.cartItems, dto.province);
  }

  @Post()
  async placeOrder(@Body() dto: PlaceOrderDto) {
    return this.orderService.placeOrder(dto.cartItems, dto.deliveryInfo);
  }

  @Get('pending')
  async getPendingOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    return this.orderService.getPendingOrders(page, limit);
  }

  @Get(':orderId')
  async getOrderDetail(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderService.getOrderDetail(orderId);
  }

  @Post(':orderId/approve')
  async approveOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderService.approveOrder(orderId);
  }

  @Post(':orderId/reject')
  async rejectOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderService.rejectOrder(orderId);
  }

  @Post(':orderId/cancel')
  async cancelOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderService.cancelOrder(orderId);
  }
}
