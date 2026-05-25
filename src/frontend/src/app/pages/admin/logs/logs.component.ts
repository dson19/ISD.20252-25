import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Log {
  id: string;
  time: string;
  barcode: string;
  title: string;
  action: string;
  actor: string;
  details: string;
}

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logs.component.html'
})
export class LogsComponent {
  logs: Log[] = [
    {
      id: 'L1',
      time: '2024-10-24 14:32:01',
      barcode: 'BK-VN2024-01',
      title: 'Mũ nồi xanh Việt Nam - Người...',
      action: 'Đã cập nhật',
      actor: 'Admin N.M.A',
      details: 'Giá: 135.000 -> 108.000'
    },
    {
      id: 'L2',
      time: '2024-10-24 11:15:44',
      barcode: 'DVD-VN2024-02',
      title: 'Mai',
      action: 'Đã tạo',
      actor: 'Hệ thống',
      details: 'Thêm mới vào kho, Tồn ban đầu: 12'
    },
    {
      id: 'L3',
      time: '2024-10-23 09:05:12',
      barcode: 'NP-VN2024-04',
      title: 'Tuổi Trẻ E-Paper 2024 Arc...',
      action: 'Đã xóa',
      actor: 'Admin N.M.A',
      details: 'Bản ghi bị xóa do ngừng phân phối'
    },
    {
      id: 'L4',
      time: '2024-10-22 16:45:00',
      barcode: 'BK-VN2024-01',
      title: 'Mũ nồi xanh Việt Nam',
      action: 'Đã cập nhật',
      actor: 'Kho vận',
      details: 'Tồn kho: 18 -> 24'
    }
  ];
}
