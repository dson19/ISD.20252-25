import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { BatchDeleteProductsDto } from './dto/batch-delete-products.dto';
import { ChangeStockDto } from './dto/change-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';

@Controller('api/products')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async searchProducts(
    @Query('keyword') keyword?: string,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    return this.productService.searchProducts({
      keyword,
      category,
      minPrice: this.parseOptionalNumber(minPrice, 'minPrice'),
      maxPrice: this.parseOptionalNumber(maxPrice, 'maxPrice'),
    });
  }

  @Get('random')
  async getRandomProducts() {
    return this.productService.getRandomProducts();
  }

  @Get('audit-logs')
  async getAuditLogs(@Headers('x-manager-id') managerId?: string) {
    this.requireManager(managerId);
    return this.productService.getAuditLogs();
  }

  @Get(':id')
  async getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.productService.getProductById(id);
  }

  @Post()
  async createProduct(
    @Body() dto: CreateProductDto,
    @Headers('x-manager-id') managerId?: string,
  ) {
    return this.productService.createProduct(dto, this.requireManager(managerId));
  }

  @Patch(':id')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @Headers('x-manager-id') managerId?: string,
  ) {
    return this.productService.updateProduct(
      id,
      dto,
      this.requireManager(managerId),
    );
  }

  @Post('batch-delete')
  async batchDeleteProducts(
    @Body() dto: BatchDeleteProductsDto,
    @Headers('x-manager-id') managerId?: string,
  ) {
    return this.productService.deleteProducts(dto, this.requireManager(managerId));
  }

  @Patch(':id/stock')
  async adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStockDto,
    @Headers('x-manager-id') managerId?: string,
  ) {
    return this.productService.adjustStock(
      id,
      dto,
      this.requireManager(managerId),
    );
  }

  private requireManager(managerId?: string): string {
    if (!managerId?.trim()) {
      throw new BadRequestException('x-manager-id header is required');
    }

    return managerId.trim();
  }

  private parseOptionalNumber(value: string | undefined, field: string) {
    if (value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`${field} must be a number`);
    }

    return parsed;
  }
}
