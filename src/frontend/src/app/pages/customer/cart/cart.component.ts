import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface CartItem {
  id: string;
  title: string;
  author: string;
  price: number;
  category: string;
  imageUrl: string;
  quantity: number;
  stockStatus: string; // e.g., 'Chỉ còn 2 sản phẩm trong kho'
  isLowStock: boolean;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html'
})
export class CartComponent {
  cartItems: CartItem[] = [
    {
      id: '1',
      title: 'Mũ nồi xanh Việt Nam - Người đi gieo hạt hòa bình',
      author: 'Nguyễn Sỹ Công, Nam Kha',
      price: 108000,
      category: 'SÁCH',
      imageUrl: 'https://placehold.co/100x130/e2e8f0/475569?text=Book',
      quantity: 1,
      stockStatus: 'Chỉ còn 2 sản phẩm trong kho',
      isLowStock: true
    },
    {
      id: '6',
      title: 'Mai',
      author: 'Phim Việt 2024 - Trấn Thành',
      price: 95000,
      category: 'DVD',
      imageUrl: 'https://placehold.co/100x130/e2e8f0/475569?text=Mai',
      quantity: 1,
      stockStatus: 'Chỉ còn 1 sản phẩm trong kho',
      isLowStock: true
    }
  ];

  get subtotal(): number {
    return this.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get vat(): number {
    return this.subtotal * 0.1;
  }

  get total(): number {
    return this.subtotal + this.vat;
  }

  increaseQuantity(item: CartItem) {
    item.quantity++;
  }

  decreaseQuantity(item: CartItem) {
    if (item.quantity > 1) {
      item.quantity--;
    }
  }

  removeItem(item: CartItem) {
    this.cartItems = this.cartItems.filter(i => i.id !== item.id);
  }
}
