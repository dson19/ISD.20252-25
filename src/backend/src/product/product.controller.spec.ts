import { BadRequestException } from '@nestjs/common';
import { ProductController } from './product.controller';

describe('ProductController', () => {
  let controller: ProductController;
  let productService: {
    searchProducts: jest.Mock;
    getRandomProducts: jest.Mock;
    getProductById: jest.Mock;
    createProduct: jest.Mock;
    updateProduct: jest.Mock;
    deleteProducts: jest.Mock;
    adjustStock: jest.Mock;
    getAuditLogs: jest.Mock;
  };

  beforeEach(() => {
    productService = {
      searchProducts: jest.fn(),
      getRandomProducts: jest.fn(),
      getProductById: jest.fn(),
      createProduct: jest.fn(),
      updateProduct: jest.fn(),
      deleteProducts: jest.fn(),
      adjustStock: jest.fn(),
      getAuditLogs: jest.fn(),
    };
    controller = new ProductController(productService as never);
  });

  it('passes search and price filters to the service', async () => {
    productService.searchProducts.mockResolvedValue([]);

    await controller.searchProducts('book', 'Fiction', '10', '20');

    expect(productService.searchProducts).toHaveBeenCalledWith({
      keyword: 'book',
      category: 'Fiction',
      minPrice: 10,
      maxPrice: 20,
    });
  });

  it('returns random products', async () => {
    productService.getRandomProducts.mockResolvedValue([]);

    await controller.getRandomProducts();

    expect(productService.getRandomProducts).toHaveBeenCalled();
  });

  it('returns one product by id', async () => {
    productService.getProductById.mockResolvedValue({ productID: 1 });

    await controller.getProductById(1);

    expect(productService.getProductById).toHaveBeenCalledWith(1);
  });

  it('requires manager header for create', async () => {
    await expect(controller.createProduct({} as never, '')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('passes manager header for create and update', async () => {
    productService.createProduct.mockResolvedValue({});
    productService.updateProduct.mockResolvedValue({});

    await controller.createProduct({ title: 'Book' } as never, 'manager-1');
    await controller.updateProduct(1, { title: 'New title' }, 'manager-1');

    expect(productService.createProduct).toHaveBeenCalledWith(
      { title: 'Book' },
      'manager-1',
    );
    expect(productService.updateProduct).toHaveBeenCalledWith(
      1,
      { title: 'New title' },
      'manager-1',
    );
  });

  it('passes batch delete and stock adjustment requests', async () => {
    productService.deleteProducts.mockResolvedValue({});
    productService.adjustStock.mockResolvedValue({});

    await controller.batchDeleteProducts({ ids: [1] }, 'manager-1');
    await controller.adjustStock(
      1,
      { quantityDelta: 2, reason: 'Restock' },
      'manager-1',
    );

    expect(productService.deleteProducts).toHaveBeenCalledWith(
      { ids: [1] },
      'manager-1',
    );
    expect(productService.adjustStock).toHaveBeenCalledWith(
      1,
      { quantityDelta: 2, reason: 'Restock' },
      'manager-1',
    );
  });

  it('returns audit logs', async () => {
    productService.getAuditLogs.mockResolvedValue([]);

    await controller.getAuditLogs('manager-1');

    expect(productService.getAuditLogs).toHaveBeenCalled();
  });
});
