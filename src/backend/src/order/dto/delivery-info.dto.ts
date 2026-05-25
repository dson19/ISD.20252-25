import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeliveryInfoDto {
  @IsString()
  @MaxLength(255)
  receiverName: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(20)
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
