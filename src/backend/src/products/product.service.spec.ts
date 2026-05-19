import { Test, TestingModule } from '@nestjs/testing';
import { Product } from './domain/product.entity';
import { ProductStatus } from './domain/product-status.enum';
import { UserRole } from './domain/user-role.enum';
import { ProductHiddenException } from './exceptions/product-hidden.exception';
import { ProductNotFoundException } from './exceptions/product-not-found.exception';
import { PRODUCT_REPOSITORY, ProductRepository } from './product.repository';
import { ProductService } from './product.service';

describe('ProductService.viewProductDetails', () => {
  let service: ProductService;
  let productRepository: jest.Mocked<ProductRepository>;

  const createProduct = (productID: number, status: ProductStatus): Product =>
    new Product({
      productID,
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

  const expectedProductDTO = (productID: number, status: ProductStatus) => ({
    productID,
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

  it('V_TC01 ViewActiveProductAsCustomerSuccess returns ProductDTO for an active product and Customer role', async () => {
    productRepository.findOne.mockResolvedValue(
      createProduct(101, ProductStatus.Active),
    );

    await expect(
      service.viewProductDetails(101, UserRole.Customer),
    ).resolves.toEqual(expectedProductDTO(101, ProductStatus.Active));
    expect(productRepository.findOne.mock.calls).toEqual([[101]]);
  });

  it('V_TC02 ViewDeactivatedProductAsCustomerError throws ProductHiddenException for a deactivated product and Customer role', async () => {
    productRepository.findOne.mockResolvedValue(
      createProduct(102, ProductStatus.Deactivated),
    );

    await expect(
      service.viewProductDetails(102, UserRole.Customer),
    ).rejects.toBeInstanceOf(ProductHiddenException);
  });

  it('V_TC03 ViewActiveProductAsPMSuccess returns ProductDTO for an active product and ProductManager role', async () => {
    productRepository.findOne.mockResolvedValue(
      createProduct(101, ProductStatus.Active),
    );

    await expect(
      service.viewProductDetails(101, UserRole.ProductManager),
    ).resolves.toEqual(expectedProductDTO(101, ProductStatus.Active));
  });

  it('V_TC04 ViewDeactivatedProductAsPMSuccess returns ProductDTO for a deactivated product and ProductManager role', async () => {
    productRepository.findOne.mockResolvedValue(
      createProduct(102, ProductStatus.Deactivated),
    );

    await expect(
      service.viewProductDetails(102, UserRole.ProductManager),
    ).resolves.toEqual(expectedProductDTO(102, ProductStatus.Deactivated));
  });

  it('V_TC05 ViewProductNotFoundError throws ProductNotFoundException when product id does not exist', async () => {
    productRepository.findOne.mockResolvedValue(null);

    await expect(
      service.viewProductDetails(99999, UserRole.Customer),
    ).rejects.toBeInstanceOf(ProductNotFoundException);
  });
});
