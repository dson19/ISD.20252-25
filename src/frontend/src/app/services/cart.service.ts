import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from './product.service';

const CART_STORAGE_KEY = 'aims_cart';

export interface CartItem {
  id: number;
  title: string;
  price: number;
  imageUrl: string;
  quantity: number;
  mediaType: string;
  quantityInStock: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsSubject = new BehaviorSubject<CartItem[]>(this.loadCart());
  readonly items$ = this.itemsSubject.asObservable();

  getCartItems(): CartItem[] {
    return this.itemsSubject.value;
  }

  addToCart(product: Product, quantity: number): void {
    const productId = product.productID;
    const requestedQuantity = this.normalizeQuantity(quantity);
    const currentItems = this.getCartItems();
    const existing = currentItems.find((item) => item.id === productId);
    const maxQuantity = Math.max(0, product.quantityInStock);

    let nextItems: CartItem[];
    if (existing) {
      nextItems = currentItems.map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + requestedQuantity, quantityInStock: maxQuantity }
          : item,
      );
    } else {
      nextItems = [
        ...currentItems,
        {
          id: productId,
          title: product.title,
          price: Number(product.currentPrice),
          imageUrl: product.imageUrl || 'https://placehold.co/300x400/e2e8f0/475569?text=AIMS',
          quantity: requestedQuantity,
          mediaType: product.mediaType,
          quantityInStock: maxQuantity,
        },
      ];
    }

    this.setItems(nextItems.filter((item) => item.quantity > 0));
  }

  updateQuantity(productId: number, quantity: number): void {
    const normalizedQuantity = this.normalizeQuantity(quantity);
    this.setItems(
      this.getCartItems().map((item) =>
        item.id === productId ? { ...item, quantity: normalizedQuantity } : item,
      ),
    );
  }

  removeItem(productId: number): void {
    this.setItems(this.getCartItems().filter((item) => item.id !== productId));
  }

  clearCart(): void {
    this.setItems([]);
  }

  get priceExcludedVAT(): number {
    return this.getCartItems().reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  get vat(): number {
    return this.priceExcludedVAT * 0.1;
  }

  get total(): number {
    return this.priceExcludedVAT + this.vat;
  }

  get itemCount(): number {
    return this.getCartItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  private setItems(items: CartItem[]): void {
    this.itemsSubject.next(items);
    this.saveCart(items);
  }

  private loadCart(): CartItem[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const rawCart = localStorage.getItem(CART_STORAGE_KEY);
    if (!rawCart) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawCart) as CartItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveCart(items: CartItem[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }

  private normalizeQuantity(quantity: number): number {
    if (!Number.isFinite(quantity)) {
      return 1;
    }

    return Math.max(1, Math.floor(quantity));
  }
}
