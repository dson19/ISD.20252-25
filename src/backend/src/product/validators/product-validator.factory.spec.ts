import { BadRequestException } from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductValidatorFactory } from './product-validator.factory';

describe('ProductValidatorFactory', () => {
  let factory: ProductValidatorFactory;

  beforeEach(() => {
    factory = new ProductValidatorFactory();
  });

  it('rejects currentPrice outside 30%-150% of originalPrice', () => {
    const dto = buildBookDto({ currentPrice: 20 });

    expect(() => factory.validateCreate(dto)).toThrow(BadRequestException);
  });

  it('selects the matching subtype validator and rejects missing detail', () => {
    const dto = buildBookDto();
    delete dto.book;

    expect(() => factory.validateCreate(dto)).toThrow(
      /requires exactly one book detail object/,
    );
  });

  it('rejects detail objects that do not match mediaType', () => {
    const dto = buildBookDto();
    dto.cd = {
      artists: 'Artist',
      recordLabel: 'Label',
      genre: 'Pop',
    };

    expect(() => factory.validateCreate(dto)).toThrow(BadRequestException);
  });

  it('rejects invalid CD tracks', () => {
    const dto: CreateProductDto = {
      ...buildCommonDto(),
      mediaType: 'CD',
      cd: {
        artists: 'Artist',
        recordLabel: 'Label',
        genre: 'Pop',
        tracks: [{ title: 'Intro', lengthSeconds: 0 }],
      },
    };

    expect(() => factory.validateCreate(dto)).toThrow(/lengthSeconds/);
  });
});

function buildBookDto(overrides: Partial<CreateProductDto> = {}) {
  return {
    ...buildCommonDto(),
    mediaType: 'BOOK',
    book: {
      authors: 'Author',
      coverType: 'PAPERBACK',
      publisher: 'Publisher',
      publicationDate: '2026-01-01',
    },
    ...overrides,
  } as CreateProductDto;
}

function buildCommonDto(): CreateProductDto {
  return {
    mediaType: 'BOOK',
    title: 'Clean Architecture',
    category: 'Book',
    barcode: 'BARCODE-1',
    weight: 1,
    originalPrice: 100,
    currentPrice: 100,
    quantityInStock: 10,
  };
}
