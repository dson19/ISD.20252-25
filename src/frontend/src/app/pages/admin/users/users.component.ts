import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Quản lý sản phẩm';
  status: 'Hoạt động' | 'Đã khóa' | 'Vô hiệu hóa';
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.component.html'
})
export class UsersComponent {
  users: User[] = [
    {
      id: 'USR-2024-001',
      name: 'Nguyễn Minh Anh',
      email: 'minhanh.nguyen@aims.vn',
      role: 'Admin',
      status: 'Hoạt động'
    },
    {
      id: 'USR-2024-002',
      name: 'Trần Thu Hà',
      email: 'thuha.tran@aims.vn',
      role: 'Quản lý sản phẩm',
      status: 'Hoạt động'
    },
    {
      id: 'USR-2024-003',
      name: 'Lê Hoàng Nam',
      email: 'hoangnam.le@aims.vn',
      role: 'Quản lý sản phẩm',
      status: 'Đã khóa'
    },
    {
      id: 'USR-2024-004',
      name: 'Phạm Ngọc Ân',
      email: 'ngocan.pham@aims.vn',
      role: 'Quản lý sản phẩm',
      status: 'Vô hiệu hóa'
    }
  ];
}
