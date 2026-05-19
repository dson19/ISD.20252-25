import { Test, TestingModule } from '@nestjs/testing';
import { Product } from './domain/product.entity';
import { ProductStatus } from './domain/product-status.enum';
import { UserRole } from './domain/user-role.enum';
import { ProductForbiddenException } from './exceptions/product-forbidden.exception';
import { ProductNotFoundException } from './exceptions/product-not-found.exception';
import { PRODUCT_REPOSITORY, ProductRepository } from './product.repository';
import { ProductService } from './product.service';

describe('ProductService.findProductDetail', () => {
  let service: ProductService;
  let productRepository: jest.Mocked<ProductRepository>;

  const createProduct = (status: ProductStatus): Product =>
    new Product({
      productID: 1,
      title: 'AIMS Book',
      category: 'Book',
      description: 'A complete AIMS book profile.',
      barcode: 'AIMS-BOOK-001',
      length: 20,
      width: 14,
      height: 3,
      weight: 0.5,
      originalValue: 100000,
      currentPrice: 120000,
      quantityInStock: 12,
      status,
      imageUrl: 'https://example.com/aims-book.jpg',
      specifications: {
        type: 'PrintableProduct',
        publisher: 'AIMS',
        language: 'Vietnamese',
        coverType: 'Paperback',
        numberOfPage: 240,
        bookCategory: 'Technology',
        authors: ['Group 25'],
      },
    });

  beforeEach(async () => {
    productRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: PRODUCT_REPOSITORY,
          useValue: productRepository,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('V_TC01 returns full detail when product exists and is active', async () => {
    productRepository.findOne.mockResolvedValue(
      createProduct(ProductStatus.Active),
    );

    await expect(
      service.findProductDetail(1, UserRole.Customer),
    ).resolves.toEqual({
      productID: 1,
      title: 'AIMS Book',
      category: 'Book',
      description: 'A complete AIMS book profile.',
      barcode: 'AIMS-BOOK-001',
      length: 20,
      width: 14,
      height: 3,
      weight: 0.5,
      originalValue: 100000,
      currentPrice: 120000,
      quantityInStock: 12,
      status: ProductStatus.Active,
      imageUrl: 'https://example.com/aims-book.jpg',
      specifications: {
        type: 'PrintableProduct',
        publisher: 'AIMS',
        language: 'Vietnamese',
        coverType: 'Paperback',
        numberOfPage: 240,
        bookCategory: 'Technology',
        authors: ['Group 25'],
      },
    });
    expect(productRepository.findOne.mock.calls).toEqual([[1]]);
  });

  it('V_TC02 throws ProductNotFoundException when product id is missing', async () => {
    productRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findProductDetail(99999, UserRole.Customer),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
  });

  it('V_TC03 blocks customers from deactivated products while product managers can view them', async () => {
    productRepository.findOne.mockResolvedValue(
      createProduct(ProductStatus.Deactivated),
    );

    await expect(
      service.findProductDetail(1, UserRole.Customer),
    ).rejects.toBeInstanceOf(ProductForbiddenException);

    await expect(
      service.findProductDetail(1, UserRole.ProductManager),
    ).resolves.toMatchObject({
      productID: 1,
      status: ProductStatus.Deactivated,
    });
  });
});
