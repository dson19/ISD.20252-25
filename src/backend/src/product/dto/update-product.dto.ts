import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreateBookDetailDto,
  CreateCdTrackDto,
  CreateDvdDetailDto,
  CreateNewspaperDetailDto,
} from './create-product.dto';

export class UpdateBookDetailDto implements Partial<CreateBookDetailDto> {
  @IsOptional()
  @IsString()
  authors?: string;

  @IsOptional()
  @IsString()
  coverType?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsDateString()
  publicationDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  numPages?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  genre?: string;
}

export class UpdateCdDetailDto {
  @IsOptional()
  @IsString()
  artists?: string;

  @IsOptional()
  @IsString()
  recordLabel?: string;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCdTrackDto)
  tracks?: CreateCdTrackDto[];
}

export class UpdateDvdDetailDto implements Partial<CreateDvdDetailDto> {
  @IsOptional()
  @IsString()
  discType?: string;

  @IsOptional()
  @IsString()
  director?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  runtimeMinutes?: number;

  @IsOptional()
  @IsString()
  studio?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  subtitles?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsString()
  genre?: string;
}

export class UpdateNewspaperDetailDto
  implements Partial<CreateNewspaperDetailDto>
{
  @IsOptional()
  @IsString()
  editorInChief?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsDateString()
  publicationDate?: string;

  @IsOptional()
  @IsString()
  issueNumber?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  issn?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  sections?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  productType?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  originalPrice?: number;

  @IsOptional()
  @IsNumber()
  currentPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantityInStock?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBookDetailDto)
  book?: UpdateBookDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCdDetailDto)
  cd?: UpdateCdDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDvdDetailDto)
  dvd?: UpdateDvdDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNewspaperDetailDto)
  newspaper?: UpdateNewspaperDetailDto;
}
