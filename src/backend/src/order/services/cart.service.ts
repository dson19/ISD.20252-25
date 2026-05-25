import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../../product/product.repository';
import { CartItemDto } from '../dto/cart-item.dto';

export interface CartStockIssue {
  productId: number;
  requestedQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  reason: string;
}

export interface CartStockCheckResult {
  available: boolean;
  issues: CartStockIssue[];
}

/**
 * CartService - Kiem tra gio hang stateless do Frontend gui len.
 *
 * COHESION: Functional Cohesion
 * Lop nay chi xu ly viec doi chieu cart voi ton kho hien tai trong database.
 *
 * COUPLING: Data Coupling
 * Backend chi nhan danh sach { productId, quantity }, khong luu bang cart va khong phu thuoc
 * vao session/login cua Customer.
 */
@Injectable()
export class CartService {
  constructor(private readonly productRepository: ProductRepository) {}

  async checkCartStock(cartItems: CartItemDto[]): Promise<CartStockCheckResult> {
    const mergedItems = this.mergeDuplicateItems(cartItems);
    const issues: CartStockIssue[] = [];

    for (const item of mergedItems) {
      const product = await this.productRepository.findById(item.productId);

      if (!product || product.status !== 'ACTIVE') {
        issues.push({
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          shortageQuantity: item.quantity,
          reason: 'PRODUCT_NOT_AVAILABLE',
        });
        continue;
      }

      if (product.quantityInStock < item.quantity) {
        issues.push({
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableQuantity: product.quantityInStock,
          shortageQuantity: item.quantity - product.quantityInStock,
          reason: 'INSUFFICIENT_STOCK',
        });
      }
    }

    return {
      available: issues.length === 0,
      issues,
    };
  }

  private mergeDuplicateItems(cartItems: CartItemDto[]): CartItemDto[] {
    const itemMap = new Map<number, number>();

    for (const item of cartItems) {
      itemMap.set(item.productId, (itemMap.get(item.productId) ?? 0) + item.quantity);
    }

    return Array.from(itemMap.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }
}
