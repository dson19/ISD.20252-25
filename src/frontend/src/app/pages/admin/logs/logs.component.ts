import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserLogRecord } from '../../../services/user.service';

/**
 * Trang Admin User Logs — hiển thị toàn bộ UserAuditLog (hành động quản trị tài khoản).
 * Dữ liệu độc lập hoàn toàn với PM product logs; chỉ tái dùng pattern UI (list + filter + stats).
 * SRP: chỉ lo hiển thị/lọc user logs, tách khỏi UsersComponent.
 */
@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs.component.html',
})
export class AdminLogsComponent implements OnInit {
  logs: UserLogRecord[] = [];
  filteredLogs: UserLogRecord[] = [];
  isLoading = false;

  searchQuery = '';
  actionFilter = '';
  timeFilter = 'ALL'; // ALL, 24H, 7D

  readonly availableActions = ['CREATE_USER', 'UPDATE_USER', 'TOGGLE_STATUS', 'RESET_PASSWORD', 'UPDATE_ROLES'];

  constructor(
    private readonly userService: UserService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.fetchLogs();
  }

  fetchLogs() {
    this.isLoading = true;
    this.userService.getLogs().subscribe({
      next: (data) => {
        this.logs = data;
        this.applyFilter();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applyFilter() {
    const query = this.searchQuery.toLowerCase().trim();
    const now = Date.now();
    this.filteredLogs = this.logs.filter((log) => {
      const email = log.user?.email || '';
      const fullName = log.user?.fullName || '';
      const actor = log.performedBy || '';
      const action = log.action || '';

      const matchesSearch =
        !query ||
        email.toLowerCase().includes(query) ||
        fullName.toLowerCase().includes(query) ||
        actor.toLowerCase().includes(query) ||
        action.toLowerCase().includes(query);

      const matchesAction = !this.actionFilter || log.action === this.actionFilter;

      let matchesTime = true;
      const logTime = new Date(log.createdAt).getTime();
      if (this.timeFilter === '24H') {
        matchesTime = now - logTime <= 24 * 60 * 60 * 1000;
      } else if (this.timeFilter === '7D') {
        matchesTime = now - logTime <= 7 * 24 * 60 * 60 * 1000;
      }

      return matchesSearch && matchesAction && matchesTime;
    });
  }

  clearFilters() {
    this.searchQuery = '';
    this.actionFilter = '';
    this.timeFilter = 'ALL';
    this.applyFilter();
  }

  get totalLogsCount(): number {
    return this.filteredLogs.length;
  }
  get createLogsCount(): number {
    return this.filteredLogs.filter((l) => l.action === 'CREATE_USER').length;
  }
  get roleLogsCount(): number {
    return this.filteredLogs.filter((l) => l.action === 'UPDATE_ROLES').length;
  }
  get securityLogsCount(): number {
    return this.filteredLogs.filter((l) => l.action === 'RESET_PASSWORD' || l.action === 'TOGGLE_STATUS').length;
  }
}
