import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
import { PRODUCT_VALIDATORS, ProductValidator } from '../interfaces/product-validator.interface';

export { PRODUCT_VALIDATORS, ProductValidator };

type DetailPayload =
  | CreateBookDetailDto
  | CreateCdDetailDto
  | CreateDvdDetailDto
  | CreateNewspaperDetailDto
  | UpdateBookDetailDto
  | UpdateCdDetailDto
  | UpdateDvdDetailDto
  | UpdateNewspaperDetailDto;

abstract class BaseProductValidator implements ProductValidator {
  abstract readonly productType: string;
  abstract readonly detailKey: string;

  validateCreate(dto: CreateProductDto): void {
    validateCommonProductFields(dto);
    validatePriceRange(dto.originalPrice, dto.currentPrice);
    this.validateCreateDetail(dto[this.detailKey as keyof CreateProductDto] as DetailPayload);
  }

  validateUpdate(dto: UpdateProductDto, existing: Product): void {
    if (dto.productType !== undefined && dto.productType !== existing.productType) {
      throw new BadRequestException('productType cannot be changed');
    }

    if (
      dto.originalPrice !== undefined &&
      Number(dto.originalPrice) !== Number(existing.originalPrice)
    ) {
      throw new BadRequestException('originalPrice cannot be changed');
    }

    validatePartialCommonProductFields(dto);
    validatePriceRange(
      dto.originalPrice ?? Number(existing.originalPrice),
      dto.currentPrice ?? Number(existing.currentPrice),
    );

    const detail = dto[this.detailKey as keyof UpdateProductDto] as DetailPayload | undefined;
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

@Injectable()
export class BookValidator extends BaseProductValidator {
  readonly productType = 'BOOK';
  readonly detailKey = 'book';

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

@Injectable()
export class CdValidator extends BaseProductValidator {
  readonly productType = 'CD';
  readonly detailKey = 'cd';

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

@Injectable()
export class DvdValidator extends BaseProductValidator {
  readonly productType = 'DVD';
  readonly detailKey = 'dvd';

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

@Injectable()
export class NewspaperValidator extends BaseProductValidator {
  readonly productType = 'NEWSPAPER';
  readonly detailKey = 'newspaper';

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
 * + SOLID Principles Review:
 *   - OCP Adherence: Validators are injected as an array via PRODUCT_VALIDATORS and indexed by
 *     productType. Adding a product type (Clothing/E-Book Reader) needs only a new validator class
 *     plus a provider entry — this factory is never modified.
 *   - SRP Adherence: The cross-type "which detail object is allowed" check lives here (it needs
 *     knowledge of every type), while each validator only validates its own fields. detailKeys is
 *     derived from the registered validators instead of a hardcoded list.
 */
@Injectable()
export class ProductValidatorFactory {
  private readonly validators: Map<string, ProductValidator>;
  private readonly detailKeys: string[];

  constructor(
    @Inject(PRODUCT_VALIDATORS) validators: ProductValidator[],
  ) {
    this.validators = new Map(
      validators.map((validator) => [validator.productType, validator]),
    );
    this.detailKeys = validators.map((validator) => validator.detailKey);
  }

  getValidator(productType: string): ProductValidator {
    const normalized = productType?.toUpperCase();
    const validator = this.validators.get(normalized);

    if (!validator) {
      throw new BadRequestException(`Unsupported productType: ${productType}`);
    }

    return validator;
  }

  validateCreate(dto: CreateProductDto): ProductValidator {
    const productType = dto.productType?.toUpperCase();
    dto.productType = productType;
    const validator = this.getValidator(productType);
    this.assertExactlyOneMatchingDetail(dto, validator.detailKey);
    validator.validateCreate(dto);
    return validator;
  }

  validateUpdate(dto: UpdateProductDto, existing: Product): ProductValidator {
    const validator = this.getValidator(existing.productType);
    if (dto.productType !== undefined) {
      dto.productType = dto.productType.toUpperCase();
    }
    this.assertNoForeignDetail(dto, validator.detailKey);
    validator.validateUpdate(dto, existing);
    return validator;
  }

  /** On create: exactly one detail object must be present and it must match the product type. */
  private assertExactlyOneMatchingDetail(
    dto: CreateProductDto,
    expectedKey: string,
  ): void {
    const providedKeys = this.detailKeys.filter(
      (key) => dto[key as keyof CreateProductDto] !== undefined,
    );

    if (providedKeys.length !== 1 || providedKeys[0] !== expectedKey) {
      throw new BadRequestException(
        `productType ${dto.productType} requires exactly one ${expectedKey} detail object`,
      );
    }
  }

  /** On update: no detail object belonging to a different product type may be present. */
  private assertNoForeignDetail(
    dto: UpdateProductDto,
    expectedKey: string,
  ): void {
    const invalidKey = this.detailKeys.find(
      (key) => key !== expectedKey && dto[key as keyof UpdateProductDto] !== undefined,
    );

    if (invalidKey) {
      throw new BadRequestException(
        `Cannot update ${invalidKey} detail for ${expectedKey} product`,
      );
    }
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
