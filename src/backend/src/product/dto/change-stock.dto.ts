import { IsInt, IsString, MinLength } from 'class-validator';

export class ChangeStockDto {
  @IsInt()
  quantityDelta: number;

  @IsString()
  @MinLength(1)
  reason: string;
}
