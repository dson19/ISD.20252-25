import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class BatchDeleteProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  ids: number[];
}
