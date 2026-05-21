import { IsNotEmpty, IsString, IsNumber, IsPositive } from 'class-validator';

export class CapturePaypalOrderDto {
  @IsNotEmpty({ message: 'Mã paypalOrderID từ PayPal không được để trống' })
  @IsString({ message: 'paypalOrderID phải là một chuỗi ký tự' })
  paypalOrderID: string; 

  @IsNotEmpty({ message: 'orderID hệ thống không được để trống' })
  @IsNumber({}, { message: 'orderID phải là một số' })
  @IsPositive({ message: 'orderID phải là số dương' })
  orderID: number; 
}