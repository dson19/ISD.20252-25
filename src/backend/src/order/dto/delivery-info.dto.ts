import { IsEmail, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class DeliveryInfoDto {
  @IsString()
  @MaxLength(255)
  receiverName: string;

  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(20)
  @Matches(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, { message: 'Số điện thoại không đúng định dạng' })
  phoneNumber: string;

  @IsString()
  @MaxLength(255)
  address: string;

  @IsString()
  @MaxLength(100)
  province: string;

  @IsOptional()
  @IsString()
  deliveryNotes?: string;
}
