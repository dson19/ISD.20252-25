import { BadRequestException } from '@nestjs/common';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let productRepository: {
    findProductsByIds: jest.Mock;
    countManagerDeleteActions: jest.Mock;
    findById: jest.Mock;
  };
  let validatorFactory: { validateCreate: jest.Mock; validateUpdate: jest.Mock };

  beforeEach(() => {
    dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    };
    productRepository = {
      findProductsByIds: jest.fn(),
      countManagerDeleteActions: jest.fn(),
      findById: jest.fn(),
    };
    validatorFactory = {
      validateCreate: jest.fn(),
      validateUpdate: jest.fn(),
    };

    service = new ProductService(
      dataSource as never,
      productRepository as never,
      validatorFactory as never,
    );
  });

  it('rejects batch delete requests over 10 products', async () => {
    await expect(
      service.deleteProducts(
        { ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
        'manager-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(productRepository.findProductsByIds).not.toHaveBeenCalled();
  });

  it('rejects batch delete when daily manager quota would exceed 20', async () => {
    productRepository.findProductsByIds.mockResolvedValue([
      buildProduct(1, 0),
      buildProduct(2, 0),
    ]);
    productRepository.countManagerDeleteActions.mockResolvedValue(19);

    await expect(
      service.deleteProducts({ ids: [1, 2] }, 'manager-1'),
    ).rejects.toThrow(/maximum 20 products per day/);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects stock adjustment that would make stock negative', async () => {
    const productRepo = {
      findOne: jest.fn().mockResolvedValue(buildProduct(1, 2)),
      save: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(productRepo),
    };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );

    await expect(
      service.adjustStock(
        1,
        { quantityDelta: -3, reason: 'Damaged items' },
        'manager-1',
      ),
    ).rejects.toThrow(/cannot make stock negative/);
    expect(productRepo.save).not.toHaveBeenCalled();
  });
});

function buildProduct(productID: number, quantityInStock: number) {
  return {
    productID,
    mediaType: 'BOOK',
    title: `Product ${productID}`,
    category: 'Book',
    barcode: `BARCODE-${productID}`,
    weight: 1,
    originalPrice: 100,
    currentPrice: 100,
    quantityInStock,
    status: 'ACTIVE',
  };
}
