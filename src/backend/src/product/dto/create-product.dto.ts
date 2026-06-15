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

export class CreateBookDetailDto {
  @IsString()
  authors: string;

  @IsString()
  coverType: string;

  @IsString()
  publisher: string;

  @IsDateString()
  publicationDate: string;

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

export class CreateCdTrackDto {
  @IsString()
  title: string;

  @IsInt()
  @Min(1)
  lengthSeconds: number;
}

export class CreateCdDetailDto {
  @IsString()
  artists: string;

  @IsString()
  recordLabel: string;

  @IsString()
  genre: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCdTrackDto)
  tracks?: CreateCdTrackDto[];
}

export class CreateDvdDetailDto {
  @IsString()
  discType: string;

  @IsString()
  director: string;

  @IsInt()
  @Min(1)
  runtimeMinutes: number;

  @IsString()
  studio: string;

  @IsString()
  language: string;

  @IsString()
  subtitles: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsString()
  genre?: string;
}

export class CreateNewspaperDetailDto {
  @IsString()
  editorInChief: string;

  @IsString()
  publisher: string;

  @IsDateString()
  publicationDate: string;

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

export class CreateProductDto {
  @IsString()
  productType: string;

  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  barcode: string;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsNumber()
  weight: number;

  @IsNumber()
  originalPrice: number;

  @IsNumber()
  currentPrice: number;

  @IsInt()
  @Min(0)
  quantityInStock: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBookDetailDto)
  book?: CreateBookDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCdDetailDto)
  cd?: CreateCdDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDvdDetailDto)
  dvd?: CreateDvdDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateNewspaperDetailDto)
  newspaper?: CreateNewspaperDetailDto;
}
