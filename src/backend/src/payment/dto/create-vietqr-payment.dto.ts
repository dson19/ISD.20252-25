import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length, Matches } from 'class-validator';

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrController because it carries only the order id, amount, and optional payment content needed by PayOrder.
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
  @IsNumber({}, { message: 'orderId must be a number' })
  @IsPositive({ message: 'orderId must be positive' })
  orderId: number;

  @IsNotEmpty({ message: 'amount is required' })
  @IsNumber({}, { message: 'amount must be a number' })
  @IsPositive({ message: 'amount must be positive' })
  amount: number;

  @IsOptional()
  @IsString({ message: 'paymentContent must be a string' })
  @Length(1, 23, { message: 'paymentContent must be between 1 and 23 characters' })
  @Matches(/^[A-Za-z0-9 ]+$/, {
    message: 'paymentContent must contain only non-accented letters, numbers, and spaces',
  })
  paymentContent?: string;
}
