import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Product {
  id: string;
  title: string;
  author: string;
  price: number;
  category: string;
  imageUrl: string;
  stock: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html'
})
export class HomeComponent {
  categories = ['Sách', 'CDs', 'DVDs', 'Báo chí'];
  
  // Mock data for display
  products: Product[] = [
    {
      id: '1',
      title: 'Mũ nồi xanh Việt Nam - Người đi gieo hạt hòa bình',
      author: 'Nguyễn Sỹ Công, Nam Kha',
      price: 250000,
      category: 'SÁCH',
      imageUrl: 'https://placehold.co/300x400/e2e8f0/475569?text=Book+Cover',
      stock: 5
    },
    {
      id: '2',
      title: 'Chiếc xe buýt hay',
      author: 'Mạc Chi, Huyết Long',
      price: 120000,
      category: 'SÁCH',
      imageUrl: 'https://placehold.co/300x400/e2e8f0/475569?text=Bus+Cover',
      stock: 12
    },
    {
      id: '3',
      title: 'Chuyện hay sử Việt',
      author: 'NXB Kim Đồng',
      price: 180000,
      category: 'SÁCH',
      imageUrl: 'https://placehold.co/300x400/e2e8f0/475569?text=History',
      stock: 3
    },
    {
      id: '4',
      title: 'Vietnamese Concert The Album',
      author: 'Hoàng Thùy Linh',
      price: 500000,
      category: 'CD',
      imageUrl: 'https://placehold.co/300x400/e2e8f0/475569?text=CD+Album',
      stock: 42
    },
    {
      id: '5',
      title: 'Bật Nó Lên',
      author: 'SOOBIN',
      price: 320000,
      category: 'CD',
      imageUrl: 'https://placehold.co/300x400/e2e8f0/475569?text=Soobin',
      stock: 10
    },
    {
      id: '6',
      title: 'Mai',
      author: 'Trấn Thành',
      price: 200000,
      category: 'DVD',
      imageUrl: 'https://placehold.co/300x400/e2e8f0/475569?text=DVD+Mai',
      stock: 50
    }
  ];

  addToCart(product: Product) {
    console.log('Added to cart', product);
  }
}
