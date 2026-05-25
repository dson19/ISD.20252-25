import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateBookDetailDto,
  CreateCdDetailDto,
  CreateDvdDetailDto,
  CreateNewspaperDetailDto,
  CreateProductDto,
} from '../dto/create-product.dto';
import {
  UpdateBookDetailDto,
  UpdateCdDetailDto,
  UpdateDvdDetailDto,
  UpdateNewspaperDetailDto,
  UpdateProductDto,
} from '../dto/update-product.dto';
import { Product } from '../entities/product.entity';

export type ProductMediaType = 'BOOK' | 'CD' | 'DVD' | 'NEWSPAPER';
type ProductDetailKey = 'book' | 'cd' | 'dvd' | 'newspaper';

export interface ProductValidator {
  readonly mediaType: ProductMediaType;
  readonly detailKey: ProductDetailKey;
  validateCreate(dto: CreateProductDto): void;
  validateUpdate(dto: UpdateProductDto, existing: Product): void;
}

type DetailPayload =
  | CreateBookDetailDto
  | CreateCdDetailDto
  | CreateDvdDetailDto
  | CreateNewspaperDetailDto
  | UpdateBookDetailDto
  | UpdateCdDetailDto
  | UpdateDvdDetailDto
  | UpdateNewspaperDetailDto;

const DETAIL_KEYS: ProductDetailKey[] = ['book', 'cd', 'dvd', 'newspaper'];

abstract class BaseProductValidator implements ProductValidator {
  abstract readonly mediaType: ProductMediaType;
  abstract readonly detailKey: ProductDetailKey;

  validateCreate(dto: CreateProductDto): void {
    validateCommonProductFields(dto);
    validatePriceRange(dto.originalPrice, dto.currentPrice);
    validateMatchingCreateDetail(dto, this.detailKey);
    this.validateCreateDetail(dto[this.detailKey] as DetailPayload);
  }

  validateUpdate(dto: UpdateProductDto, existing: Product): void {
    if (dto.mediaType !== undefined && dto.mediaType !== existing.mediaType) {
      throw new BadRequestException('mediaType cannot be changed');
    }

    validatePartialCommonProductFields(dto);
    validatePriceRange(
      dto.originalPrice ?? Number(existing.originalPrice),
      dto.currentPrice ?? Number(existing.currentPrice),
    );
    validateMatchingUpdateDetail(dto, this.detailKey);

    const detail = dto[this.detailKey] as DetailPayload | undefined;
    if (detail) {
      this.validateUpdateDetail(detail);
    }
  }

  protected validateRequiredString(value: unknown, fieldName: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${fieldName} is required`);
    }
  }

  protected validatePositiveNumber(value: unknown, fieldName: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(`${fieldName} must be greater than 0`);
    }
  }

  protected validateOptionalPositiveNumber(
    value: unknown,
    fieldName: string,
  ): void {
    if (value !== undefined && value !== null) {
      this.validatePositiveNumber(value, fieldName);
    }
  }

  protected abstract validateCreateDetail(detail: DetailPayload): void;
  protected abstract validateUpdateDetail(detail: DetailPayload): void;
}

class BookValidator extends BaseProductValidator {
  readonly mediaType = 'BOOK' as const;
  readonly detailKey = 'book' as const;

  protected validateCreateDetail(detail: CreateBookDetailDto): void {
    this.validateRequiredString(detail.authors, 'book.authors');
    this.validateRequiredString(detail.coverType, 'book.coverType');
    this.validateRequiredString(detail.publisher, 'book.publisher');
    this.validateRequiredString(detail.publicationDate, 'book.publicationDate');
    this.validateOptionalPositiveNumber(detail.numPages, 'book.numPages');
  }

  protected validateUpdateDetail(detail: UpdateBookDetailDto): void {
    this.validateOptionalPositiveNumber(detail.numPages, 'book.numPages');
  }
}

class CdValidator extends BaseProductValidator {
  readonly mediaType = 'CD' as const;
  readonly detailKey = 'cd' as const;

  protected validateCreateDetail(detail: CreateCdDetailDto): void {
    this.validateRequiredString(detail.artists, 'cd.artists');
    this.validateRequiredString(detail.recordLabel, 'cd.recordLabel');
    this.validateRequiredString(detail.genre, 'cd.genre');
    validateCdTracks(detail.tracks);
  }

  protected validateUpdateDetail(detail: UpdateCdDetailDto): void {
    validateCdTracks(detail.tracks);
  }
}

class DvdValidator extends BaseProductValidator {
  readonly mediaType = 'DVD' as const;
  readonly detailKey = 'dvd' as const;

  protected validateCreateDetail(detail: CreateDvdDetailDto): void {
    this.validateRequiredString(detail.discType, 'dvd.discType');
    this.validateRequiredString(detail.director, 'dvd.director');
    this.validatePositiveNumber(detail.runtimeMinutes, 'dvd.runtimeMinutes');
    this.validateRequiredString(detail.studio, 'dvd.studio');
    this.validateRequiredString(detail.language, 'dvd.language');
    this.validateRequiredString(detail.subtitles, 'dvd.subtitles');
  }

  protected validateUpdateDetail(detail: UpdateDvdDetailDto): void {
    this.validateOptionalPositiveNumber(
      detail.runtimeMinutes,
      'dvd.runtimeMinutes',
    );
  }
}

class NewspaperValidator extends BaseProductValidator {
  readonly mediaType = 'NEWSPAPER' as const;
  readonly detailKey = 'newspaper' as const;

  protected validateCreateDetail(detail: CreateNewspaperDetailDto): void {
    this.validateRequiredString(
      detail.editorInChief,
      'newspaper.editorInChief',
    );
    this.validateRequiredString(detail.publisher, 'newspaper.publisher');
    this.validateRequiredString(
      detail.publicationDate,
      'newspaper.publicationDate',
    );
  }

  protected validateUpdateDetail(): void {
    return;
  }
}

/**
 * + Coupling/Cohesion level:
 *   - Control Coupling: Decides and dispatches validator strategy instances based on string parameter flags passed by ProductService.
 *   - Functional Cohesion: Dedicated entirely to instantiating, selecting, and returning the correct type-specific validator.
 * + Reason why:
 *   - Centralizing sub-validation setup inside a specialized factory prevents core catalog modules from hardcoding product-type rules.
 */
@Injectable()
export class ProductValidatorFactory {
  private readonly validators = new Map<ProductMediaType, ProductValidator>([
    ['BOOK', new BookValidator()],
    ['CD', new CdValidator()],
    ['DVD', new DvdValidator()],
    ['NEWSPAPER', new NewspaperValidator()],
  ]);

  getValidator(mediaType: string): ProductValidator {
    const normalized = mediaType?.toUpperCase() as ProductMediaType;
    const validator = this.validators.get(normalized);

    if (!validator) {
      throw new BadRequestException(`Unsupported mediaType: ${mediaType}`);
    }

    return validator;
  }

  validateCreate(dto: CreateProductDto): ProductValidator {
    const mediaType = dto.mediaType?.toUpperCase();
    dto.mediaType = mediaType;
    const validator = this.getValidator(mediaType);
    validator.validateCreate(dto);
    return validator;
  }

  validateUpdate(dto: UpdateProductDto, existing: Product): ProductValidator {
    const validator = this.getValidator(existing.mediaType);
    if (dto.mediaType !== undefined) {
      dto.mediaType = dto.mediaType.toUpperCase();
    }
    validator.validateUpdate(dto, existing);
    return validator;
  }
}

function validateCommonProductFields(dto: CreateProductDto): void {
  validateRequiredString(dto.title, 'title');
  validateRequiredString(dto.category, 'category');
  validateRequiredString(dto.barcode, 'barcode');
  validatePositiveNumber(dto.weight, 'weight');
  validateNonNegativeInteger(dto.quantityInStock, 'quantityInStock');
  validateOptionalPositiveNumber(dto.length, 'length');
  validateOptionalPositiveNumber(dto.width, 'width');
  validateOptionalPositiveNumber(dto.height, 'height');
}

function validatePartialCommonProductFields(dto: UpdateProductDto): void {
  validateOptionalPositiveNumber(dto.weight, 'weight');
  validateOptionalPositiveNumber(dto.length, 'length');
  validateOptionalPositiveNumber(dto.width, 'width');
  validateOptionalPositiveNumber(dto.height, 'height');

  if (dto.quantityInStock !== undefined) {
    validateNonNegativeInteger(dto.quantityInStock, 'quantityInStock');
  }
}

function validatePriceRange(originalPrice: number, currentPrice: number): void {
  validatePositiveNumber(originalPrice, 'originalPrice');

  if (
    typeof currentPrice !== 'number' ||
    !Number.isFinite(currentPrice) ||
    currentPrice < originalPrice * 0.3 ||
    currentPrice > originalPrice * 1.5
  ) {
    throw new BadRequestException(
      'currentPrice must be between 30% and 150% of originalPrice',
    );
  }
}

function validateMatchingCreateDetail(
  dto: CreateProductDto,
  expectedKey: ProductDetailKey,
): void {
  const providedKeys = DETAIL_KEYS.filter((key) => dto[key] !== undefined);

  if (providedKeys.length !== 1 || providedKeys[0] !== expectedKey) {
    throw new BadRequestException(
      `mediaType ${dto.mediaType} requires exactly one ${expectedKey} detail object`,
    );
  }
}

function validateMatchingUpdateDetail(
  dto: UpdateProductDto,
  expectedKey: ProductDetailKey,
): void {
  const invalidKey = DETAIL_KEYS.find(
    (key) => key !== expectedKey && dto[key] !== undefined,
  );

  if (invalidKey) {
    throw new BadRequestException(
      `Cannot update ${invalidKey} detail for ${expectedKey} product`,
    );
  }
}

function validateCdTracks(
  tracks: CreateCdDetailDto['tracks'] | UpdateCdDetailDto['tracks'],
): void {
  if (tracks === undefined) {
    return;
  }

  if (!Array.isArray(tracks)) {
    throw new BadRequestException('cd.tracks must be an array');
  }

  for (const track of tracks) {
    validateRequiredString(track.title, 'cd.tracks.title');
    validatePositiveNumber(track.lengthSeconds, 'cd.tracks.lengthSeconds');
  }
}

function validateRequiredString(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${fieldName} is required`);
  }
}

function validatePositiveNumber(value: unknown, fieldName: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${fieldName} must be greater than 0`);
  }
}

function validateOptionalPositiveNumber(
  value: unknown,
  fieldName: string,
): void {
  if (value !== undefined && value !== null) {
    validatePositiveNumber(value, fieldName);
  }
}

function validateNonNegativeInteger(value: unknown, fieldName: string): void {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new BadRequestException(`${fieldName} must be a non-negative integer`);
  }
}
