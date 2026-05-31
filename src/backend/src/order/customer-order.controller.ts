import { Controller, Get, Param, ParseIntPipe, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { OrderService } from './services/order.service';

@Controller('api/customer/orders')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class CustomerOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':orderId')
  async getCustomerOrderDetail(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query('token') token: string,
  ) {
    return this.orderService.getCustomerOrderDetail(orderId, token);
  }

  @Post(':orderId/cancel')
  async cancelCustomerOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query('token') token: string,
  ) {
    return this.orderService.cancelCustomerOrder(orderId, token);
  }
}
