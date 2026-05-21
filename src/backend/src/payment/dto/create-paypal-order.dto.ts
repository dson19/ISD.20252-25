import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class CreatePaypalOrderDto {
  @IsNotEmpty({ message: 'Missing orderID' })
  @IsNumber({}, { message: 'orderID must be a number' })
  @IsPositive({ message: 'orderID must be a positive number' })
  orderID: number;
}
