import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Product {
  id: string;
  barcode: string;
  title: string;
  author: string;
  category: string;
  stock: number;
  price: number;
  status: 'ACTIVE' | 'DEACTIVATED';
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './products.component.html'
})
export class ProductsComponent {
  products: Product[] = [
    {
      id: 'P1',
      barcode: 'BK-VN2024-01',
      title: 'Mũ nồi xanh Việt Nam - Người đi gieo hạt hòa bình',
      author: 'Nguyễn Sỹ Công, Nam Kha',
      category: 'SÁCH',
      stock: 24,
      price: 108000,
      status: 'ACTIVE'
    },
    {
      id: 'P2',
      barcode: 'DVD-VN2024-02',
      title: 'Mai',
      author: 'Trấn Thành',
      category: 'DVD',
      stock: 12,
      price: 95000,
      status: 'ACTIVE'
    },
    {
      id: 'P3',
      barcode: 'CD-VN2024-03',
      title: 'Vietnamese Concert The Album',
      author: 'Hoàng Thùy Linh',
      category: 'CD',
      stock: 8,
      price: 450000,
      status: 'ACTIVE'
    },
    {
      id: 'P4',
      barcode: 'NP-VN2024-04',
      title: 'Tuổi Trẻ E-Paper 2024 Archive',
      author: 'Ấn bản lưu trữ 2024',
      category: 'BÁO',
      stock: 0,
      price: 35000,
      status: 'DEACTIVATED'
    }
  ];
}
