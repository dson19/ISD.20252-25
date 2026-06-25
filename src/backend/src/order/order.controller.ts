import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { CheckCartStockDto } from './dto/check-cart-stock.dto';
import { DeliveryInfoDto } from './dto/delivery-info.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { ShippingFeeDto } from './dto/shipping-fee.dto';
import { CartService } from './services/cart.service';
import { OrderService } from './services/order.service';
import { OrderQueryService, OrderListFilters } from './services/order-query.service';
import { OrderRefundService } from './services/order-refund.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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
    private readonly orderQueryService: OrderQueryService,
    private readonly orderRefundService: OrderRefundService,
  ) { }

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCT_MANAGER')
  async getPendingOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('dateRange') dateRange?: OrderListFilters['dateRange'],
    @Query('paymentMethod') paymentMethod?: OrderListFilters['paymentMethod'],
  ) {
    return this.orderQueryService.getPendingOrders(page, limit, { search, dateRange, paymentMethod });
  }

  @Get('vietqr-refunds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCT_MANAGER')
  async getVietqrRefunds(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('dateRange') dateRange?: OrderListFilters['dateRange'],
    @Query('paymentMethod') paymentMethod?: OrderListFilters['paymentMethod'],
  ) {
    return this.orderQueryService.getVietqrRefundRequests(page, limit, { search, dateRange, paymentMethod });
  }

  @Get(':orderId')
  async getOrderDetail(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderService.getOrderDetail(orderId);
  }

  @Patch(':orderId/delivery-info')
  async updateDeliveryInfo(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: DeliveryInfoDto,
  ) {
    return this.orderService.updateDeliveryInfo(orderId, dto);
  }

  @Post(':orderId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCT_MANAGER')
  async approveOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderService.approveOrder(orderId);
  }

  @Post(':orderId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCT_MANAGER')
  async rejectOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderService.rejectOrder(orderId);
  }

  @Post(':orderId/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCT_MANAGER')
  async cancelOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderService.cancelOrder(orderId);
  }

  @Post(':orderId/confirm-vietqr-refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCT_MANAGER')
  async confirmVietqrRefund(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderRefundService.confirmVietqrRefund(orderId);
  }
}
