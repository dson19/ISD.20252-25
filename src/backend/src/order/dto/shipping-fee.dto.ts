import { Type } from 'class-transformer';
import { ArrayMinSize, IsString, MaxLength, ValidateNested } from 'class-validator';
import { CartItemDto } from './cart-item.dto';

export class ShippingFeeDto {
  @IsString()
  @MaxLength(100)
  province: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cartItems: CartItemDto[];
}
