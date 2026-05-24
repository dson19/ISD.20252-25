import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class RefundOrderDto {
  @IsNotEmpty({ message: 'Mising orderID' })
  @IsNumber({}, { message: 'Invalid orderID' })
  @IsPositive({ message: 'Invalid orderID' })
  orderID: number; 
}