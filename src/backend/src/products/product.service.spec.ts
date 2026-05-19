import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Product } from './domain/product.entity';
import { ProductStatus } from './domain/product-status.enum';
import { UserRole } from './domain/user-role.enum';
import { ProductHiddenException } from './exceptions/product-hidden.exception';
import { ProductNotFoundException } from './exceptions/product-not-found.exception';
import { PRODUCT_REPOSITORY, ProductRepository } from './product.repository';
import { ProductService } from './product.service';

describe('ProductService', () => {
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
      findByBarcode: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      checkInOrders: jest.fn(),
      getDailyDeletionCount: jest.fn(),
    } as unknown as jest.Mocked<ProductRepository>;

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('viewProductDetails', () => {
    it('V_TC01 ViewActiveProductAsCustomerSuccess returns ProductDTO for an active product and Customer role', async () => {
      productRepository.findOne.mockResolvedValue(createProduct(101, ProductStatus.Active));

      await expect(service.viewProductDetails(101, UserRole.Customer))
        .resolves.toEqual(expectedProductDTO(101, ProductStatus.Active));
      expect(productRepository.findOne.mock.calls).toEqual([[101]]);
    });

    it('V_TC02 ViewDeactivatedProductAsCustomerError throws ProductHiddenException for a deactivated product and Customer role', async () => {
      productRepository.findOne.mockResolvedValue(createProduct(102, ProductStatus.Deactivated));

      await expect(service.viewProductDetails(102, UserRole.Customer))
        .rejects.toBeInstanceOf(ProductHiddenException);
    });

    it('V_TC03 ViewActiveProductAsPMSuccess returns ProductDTO for an active product and ProductManager role', async () => {
      productRepository.findOne.mockResolvedValue(createProduct(101, ProductStatus.Active));

      await expect(service.viewProductDetails(101, UserRole.ProductManager))
        .resolves.toEqual(expectedProductDTO(101, ProductStatus.Active));
    });

    it('V_TC04 ViewDeactivatedProductAsPMSuccess returns ProductDTO for a deactivated product and ProductManager role', async () => {
      productRepository.findOne.mockResolvedValue(createProduct(102, ProductStatus.Deactivated));

      await expect(service.viewProductDetails(102, UserRole.ProductManager))
        .resolves.toEqual(expectedProductDTO(102, ProductStatus.Deactivated));
    });

    it('V_TC05 ViewProductNotFoundError throws ProductNotFoundException when product id does not exist', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.viewProductDetails(99999, UserRole.Customer))
        .rejects.toBeInstanceOf(ProductNotFoundException);
    });
  });

  describe('Specific Product Type Validators', () => {
    it('P_TC01 ValidateBookFieldsSuccess', () => {
      expect(service.validateBookFields({ action: 'CREATE', type: 'Book' })).toBe(true);
    });

    it('P_TC05 ValidateBookFieldsMissingError', () => {
      expect(() => service.validateBookFields({ action: 'UPDATE', updatedData: { author: '' } }))
        .toThrow(BadRequestException);
    });

    it('P_TC02 ValidateNewspaperFieldsSuccess', () => {
      expect(service.validateNewspaperFields({ action: 'CREATE', type: 'Newspaper' })).toBe(true);
    });

    it('P_TC06 ValidateNewspaperFieldsMissingError', () => {
      expect(() => service.validateNewspaperFields({ action: 'UPDATE', updatedData: { publisher: '' } }))
        .toThrow(BadRequestException);
    });

    it('P_TC03 ValidateCDFieldsSuccess', () => {
      expect(service.validateCDFields({ action: 'CREATE', type: 'CD' })).toBe(true);
    });

    it('P_TC07 ValidateCDFieldsMissingError', () => {
      expect(() => service.validateCDFields({ action: 'UPDATE', updatedData: { tracksList: [] } }))
        .toThrow(BadRequestException);
    });

    it('P_TC04 ValidateDVDFieldsSuccess', () => {
      expect(service.validateDVDFields({ action: 'CREATE', type: 'DVD' })).toBe(true);
    });

    it('P_TC08 ValidateDVDFieldsMissingError', () => {
      expect(() => service.validateDVDFields({ action: 'UPDATE', updatedData: { director: '' } }))
        .toThrow(BadRequestException);
    });
  });

  describe('createProduct', () => {
    it('P_TC09 CreateBookSuccess', async () => {
      const dto = { type: 'Book', barcode: '89301', title: 'Valid Book' };
      productRepository.findByBarcode.mockResolvedValue(null);
      productRepository.create.mockReturnValue(dto as any);
      productRepository.save.mockResolvedValue({ id: 1, ...dto } as any);

      const result = await service.createProduct(dto);
      expect(result.id).toBe(1);
      expect(productRepository.save).toHaveBeenCalled();
    });

    it('P_TC13 CreateProductDuplicateBarcode', async () => {
      const dto = { type: 'CD', barcode: '89301', title: 'Duplicate' };
      productRepository.findByBarcode.mockResolvedValue({ id: 99 } as any);

      await expect(service.createProduct(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if title is empty', async () => {
      const dto = { type: 'Book', barcode: '12345', title: '   ' };
      productRepository.findByBarcode.mockResolvedValue(null);

      await expect(service.createProduct(dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('handleUpdate', () => {
    beforeEach(() => {
      productRepository.save.mockImplementation(async (p) => p as any);
    });

    it('P_TC14 UpdatePriceMinValidBound', async () => {
      const dbProduct = { id: 1, originalValue: 100000 };
      const dto = { originalPrice: 100000, newPrice: 30000 };
      productRepository.findOne.mockResolvedValue(dbProduct as any);

      const result = await service.handleUpdate(1, dto);
      expect(result.newPrice).toBe(30000);
    });

    it('P_TC15 UpdatePriceMinInvalidBound', async () => {
      const dbProduct = { id: 1, originalValue: 100000 };
      const dto = { originalPrice: 100000, newPrice: 29999 };
      productRepository.findOne.mockResolvedValue(dbProduct as any);

      await expect(service.handleUpdate(1, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('P_TC16 UpdatePriceMaxValidBound', async () => {
      const dbProduct = { id: 1, originalValue: 100000 };
      const dto = { originalPrice: 100000, newPrice: 150000 };
      productRepository.findOne.mockResolvedValue(dbProduct as any);

      const result = await service.handleUpdate(1, dto);
      expect(result.newPrice).toBe(150000);
    });

    it('P_TC17 UpdatePriceMaxInvalidBound', async () => {
      const dbProduct = { id: 1, originalValue: 100000 };
      const dto = { originalPrice: 100000, newPrice: 150001 };
      productRepository.findOne.mockResolvedValue(dbProduct as any);

      await expect(service.handleUpdate(1, dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('handleDeletion', () => {
    beforeEach(() => {
      productRepository.getDailyDeletionCount.mockResolvedValue(0);
    });

    it('P_TC18 SoftDeleteWithStock', async () => {
      const mockProduct = { id: 10, quantityInStock: 5, status: 'active' };
      productRepository.findOne.mockResolvedValue(mockProduct as any);
      productRepository.checkInOrders.mockResolvedValue(false);

      await service.handleDeletion([10]);
      expect(mockProduct.status).toBe('deactivated');
      expect(productRepository.save).toHaveBeenCalledWith(mockProduct);
      expect(productRepository.delete).not.toHaveBeenCalled();
    });

    it('P_TC19 HardDeleteNoStock', async () => {
      const mockProduct = { id: 11, quantityInStock: 0, status: 'active' };
      productRepository.findOne.mockResolvedValue(mockProduct as any);
      productRepository.checkInOrders.mockResolvedValue(false);

      await service.handleDeletion([11]);
      expect(productRepository.delete).toHaveBeenCalledWith(11);
      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it('P_TC20 BulkDeleteAtMaxBound', async () => {
      const mockProduct = { id: 1, quantityInStock: 0 };
      productRepository.findOne.mockResolvedValue(mockProduct as any);
      productRepository.checkInOrders.mockResolvedValue(false);

      const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      await service.handleDeletion(ids);
      expect(productRepository.delete).toHaveBeenCalledTimes(10);
    });

    it('P_TC21 BulkDeleteExceedMaxBoundError', async () => {
      const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      await expect(service.handleDeletion(ids)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('P_TC22 DailyDeleteAtMaxLimit', async () => {
      productRepository.getDailyDeletionCount.mockResolvedValue(18);
      const mockProduct = { id: 12, quantityInStock: 0 };
      productRepository.findOne.mockResolvedValue(mockProduct as any);
      productRepository.checkInOrders.mockResolvedValue(false);

      await service.handleDeletion([12, 13]);
      expect(productRepository.delete).toHaveBeenCalledTimes(2);
    });

    it('P_TC23 DailyDeleteExceedLimitError', async () => {
      productRepository.getDailyDeletionCount.mockResolvedValue(20);
      await expect(service.handleDeletion([14])).rejects.toBeInstanceOf(ForbiddenException);
    });
    
    it('should throw ConflictException if product is linked to an order', async () => {
      const mockProduct = { id: 15, quantityInStock: 0 };
      productRepository.findOne.mockResolvedValue(mockProduct as any);
      productRepository.checkInOrders.mockResolvedValue(true);

      await expect(service.handleDeletion([15])).rejects.toBeInstanceOf(ConflictException);
    });
  });
});