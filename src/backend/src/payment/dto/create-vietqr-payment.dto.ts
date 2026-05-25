import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Length, Matches } from 'class-validator';

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrController because it carries only the order id, amount, and content needed by PayOrder.
 * - Avoids Control Coupling by not carrying a gateway selector or mode flag.
 * - Avoids Stamp Coupling by excluding Order, Cart, Checkout, and Shipping objects.
 *
 * Cohesion:
 * - Functional Cohesion because this DTO validates only VietQR payment creation input.
 *
 * Reason:
 * - A narrow DTO keeps HTTP validation separate from VietQR API and persistence concerns.
 *
 * Improvement Direction:
 * - Add request examples through Swagger decorators if API documentation is added later.
 */
export class CreateVietqrPaymentDto {
  @IsNotEmpty({ message: 'orderId is required' })
  @Type(() => Number)
  @IsInt({ message: 'orderId must be an integer' })
  @IsPositive({ message: 'orderId must be positive' })
  orderId: number;

  @IsNotEmpty({ message: 'amount is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @IsPositive({ message: 'amount must be positive' })
  amount: number;

  @IsNotEmpty({ message: 'content is required' })
  @IsString({ message: 'content must be a string' })
  @Length(1, 23, { message: 'content must be between 1 and 23 characters' })
  @Matches(/^[A-Za-z0-9 ]+$/, {
    message: 'content must contain only non-accented letters, numbers, and spaces',
  })
  content: string;
}
