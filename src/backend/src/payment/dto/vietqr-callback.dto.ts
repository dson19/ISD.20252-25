import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsPositive } from 'class-validator';

/**
 * Lab 11 Design Review
 * Coupling:
 * - Data Coupling with VietqrPaymentService because it carries only callback fields needed to verify and update a payment.
 * - Avoids Control Coupling by not instructing the service which branch to execute beyond the transaction type reported by VietQR.
 * - Avoids Stamp Coupling by excluding unrelated VietQR metadata and full banking records.
 *
 * Cohesion:
 * - Functional Cohesion because this DTO validates only VietQR transaction-sync callback input.
 *
 * Reason:
 * - A small callback DTO makes idempotent verification testable without exposing raw webhook shape across the module.
 *
 * Improvement Direction:
 * - Add signature validation fields if VietQR signing is enabled for the merchant account.
 */
export class VietqrCallbackDto {
  @IsNotEmpty({ message: 'bankaccount is required' })
  @IsString({ message: 'bankaccount must be a string' })
  bankaccount: string;

  @IsNotEmpty({ message: 'amount is required' })
  @IsNumber({}, { message: 'amount must be a number' })
  @IsPositive({ message: 'amount must be positive' })
  amount: number;

  @IsNotEmpty({ message: 'transType is required' })
  @IsString({ message: 'transType must be a string' })
  @IsIn(['C', 'D'], { message: 'transType must be C or D' })
  transType: 'C' | 'D';

  @IsNotEmpty({ message: 'content is required' })
  @IsString({ message: 'content must be a string' })
  content: string;

  @IsNotEmpty({ message: 'transactionid is required' })
  @IsString({ message: 'transactionid must be a string' })
  transactionid: string;

  @IsNotEmpty({ message: 'transactiontime is required' })
  @IsNumber({}, { message: 'transactiontime must be a number' })
  transactiontime: number;

  @IsNotEmpty({ message: 'referencenumber is required' })
  @IsString({ message: 'referencenumber must be a string' })
  referencenumber: string;

  @IsNotEmpty({ message: 'orderId is required' })
  @IsString({ message: 'orderId must be a string' })
  orderId: string;

  @IsOptional()
  @IsString({ message: 'terminalCode must be a string' })
  terminalCode?: string;

  @IsOptional()
  @IsString({ message: 'sign must be a string' })
  sign?: string;
}
