import { Component, OnInit, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../../app.config';
import { FormsModule } from '@angular/forms';

interface Role {
  roleID: number;
  name: string;
}

interface UserAuditLog {
  logID: number;
  action: string;
  description: string;
  performedBy: string;
  createdAt: string;
}

interface User {
  userID: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  roles: Role[];
  auditLogs?: UserAuditLog[];
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html'
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  searchQuery = '';
  roleFilter = '';
  statusFilter = '';
  isLoading = false;

  // Statistic getters for Dashboard Metrics Panel
  get totalUsersCount(): number {
    return this.users.length;
  }

  get activeUsersCount(): number {
    return this.users.filter(u => u.status === 'ACTIVE').length;
  }

  get lockedUsersCount(): number {
    return this.users.filter(u => u.status === 'DEACTIVATED').length;
  }

  get adminUsersCount(): number {
    return this.users.filter(u => u.roles && u.roles.some(r => r.name === 'ADMIN')).length;
  }

  // Audit logs expand/collapse tracking
  expandedUserIds = new Set<number>();

  // Modal control for Editing Roles
  isRolesModalOpen = false;
  selectedUserForRoles: User | null = null;
  availableRoles = ['ADMIN', 'PRODUCT_MANAGER', 'STAFF'];
  selectedRolesMap: { [key: string]: boolean } = {};

  // Modal control for Reset Password Result
  isResetPwdModalOpen = false;
  resetPwdResult: {
    email: string;
    fullName: string;
    newPassword?: string;
  } | null = null;

  // Custom Popup Alert/Confirm properties
  isConfirmModalOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'info' | 'warning' | 'danger' = 'info';
  confirmAction: (() => void) | null = null;

  isAlertModalOpen = false;
  alertTitle = '';
  alertMessage = '';
  alertType: 'success' | 'error' | 'warning' | 'info' = 'info';


  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.fetchUsers();
  }

  fetchUsers() {
    this.isLoading = true;
    console.log('[UsersComponent] fetchUsers() bat dau goi API...');
    console.log('[UsersComponent] baseUrl:', this.baseUrl);
    console.log('[UsersComponent] Full URL:', `${this.baseUrl}/api/users`);
    
    this.http.get<User[]>(`${this.baseUrl}/api/users`).subscribe({
      next: (data) => {
        console.log('[UsersComponent] fetchUsers() nhan du lieu thanh cong:', data);
        this.users = data;
        this.applyFilter();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[UsersComponent] fetchUsers() gap loi khi goi API:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter() {
    const query = this.searchQuery.toLowerCase().trim();
    this.filteredUsers = this.users.filter((user) => {
      const fullName = user.fullName || '';
      const email = user.email || '';

      // 1. Search Query filter (matches full name, email or ID)
      const matchesSearch =
        !query ||
        fullName.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        String(user.userID).includes(query);

      // 2. Role filter
      const matchesRole =
        !this.roleFilter ||
        (user.roles && user.roles.some((r) => r.name === this.roleFilter));

      // 3. Status filter
      const matchesStatus =
        !this.statusFilter ||
        user.status === this.statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  clearFilters() {
    this.searchQuery = '';
    this.roleFilter = '';
    this.statusFilter = '';
    this.applyFilter();
  }

  // Toggle user active status
  toggleUserStatus(user: User) {
    const newStatus = user.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    const actionText = newStatus === 'ACTIVE' ? 'mở khóa' : 'khóa';
    
    this.showConfirm(
      'Xác nhận thay đổi trạng thái',
      `Bạn có chắc chắn muốn ${actionText} tài khoản [${user.email}]?`,
      newStatus === 'ACTIVE' ? 'info' : 'warning',
      () => {
        this.http
          .patch<User>(`${this.baseUrl}/api/users/${user.userID}/status`, {
            status: newStatus
          })
          .subscribe({
            next: (updatedUser) => {
              user.status = updatedUser.status;
              this.fetchUsers(); // Refresh to get updated audit logs
              this.showAlert('Thành công', `Đã ${actionText} tài khoản [${user.email}] thành công.`, 'success');
            },
            error: (err) => {
              this.showAlert('Thao tác thất bại', err.error?.message || `Không thể ${actionText} tài khoản`, 'error');
            }
          });
      }
    );
  }

  // Expand / collapse audit logs panel
  toggleAuditLogs(userID: number) {
    if (this.expandedUserIds.has(userID)) {
      this.expandedUserIds.delete(userID);
    } else {
      this.expandedUserIds.add(userID);
    }
  }

  // Edit Roles Modal trigger
  openRolesModal(user: User, event: Event) {
    event.stopPropagation(); // Avoid triggering row click / expansion
    this.selectedUserForRoles = user;
    this.selectedRolesMap = {};
    
    // Check checkboxes based on current user roles
    this.availableRoles.forEach((role) => {
      this.selectedRolesMap[role] = user.roles.some((r) => r.name === role);
    });
    
    this.isRolesModalOpen = true;
  }

  closeRolesModal() {
    this.isRolesModalOpen = false;
    this.selectedUserForRoles = null;
  }

  saveRoles() {
    if (!this.selectedUserForRoles) return;

    const chosenRoles = Object.keys(this.selectedRolesMap).filter(
      (roleName) => this.selectedRolesMap[roleName]
    );

    if (chosenRoles.length === 0) {
      this.showAlert('Cảnh báo', 'Vui lòng chọn ít nhất một vai trò cho người dùng', 'warning');
      return;
    }

    this.http
      .patch<User>(`${this.baseUrl}/api/users/${this.selectedUserForRoles.userID}/roles`, {
        roles: chosenRoles
      })
      .subscribe({
        next: (updatedUser) => {
          this.closeRolesModal();
          this.fetchUsers(); // Refresh to update list and logs
          this.showAlert('Cập nhật thành công', 'Cập nhật vai trò người dùng thành công.', 'success');
        },
        error: (err) => {
          this.showAlert('Lỗi cập nhật', err.error?.message || 'Không thể cập nhật vai trò người dùng', 'error');
        }
      });
  }

  // Reset Password trigger
  resetPassword(user: User, event: Event) {
    event.stopPropagation(); // Avoid triggering row click
    
    this.showConfirm(
      'Xác nhận reset mật khẩu',
      `Bạn có chắc chắn muốn reset mật khẩu cho tài khoản [${user.email}]? Mật khẩu mới sẽ được sinh ngẫu nhiên tạm thời.`,
      'warning',
      () => {
        this.http
          .post<any>(`${this.baseUrl}/api/auth/reset-password/${user.userID}`, {})
          .subscribe({
            next: (res) => {
              this.resetPwdResult = {
                email: res.email,
                fullName: res.fullName,
                newPassword: res.newPassword
              };
              this.isResetPwdModalOpen = true;
              this.fetchUsers(); // Refresh to get updated audit logs
            },
            error: (err) => {
              this.showAlert('Reset thất bại', err.error?.message || 'Không thể reset mật khẩu người dùng', 'error');
            }
          });
      }
    );
  }

  closeResetPwdModal() {
    this.isResetPwdModalOpen = false;
    this.resetPwdResult = null;
  }

  // Helper Methods for Custom Alert & Confirm Popups
  showAlert(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    this.alertTitle = title;
    this.alertMessage = message;
    this.alertType = type;
    this.isAlertModalOpen = true;
    this.cdr.detectChanges();
  }

  closeAlert() {
    this.isAlertModalOpen = false;
    this.cdr.detectChanges();
  }

  showConfirm(title: string, message: string, type: 'info' | 'warning' | 'danger', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.confirmAction = action;
    this.isConfirmModalOpen = true;
    this.cdr.detectChanges();
  }

  closeConfirm() {
    this.isConfirmModalOpen = false;
    this.confirmAction = null;
    this.cdr.detectChanges();
  }

  triggerConfirmAction() {
    if (this.confirmAction) {
      this.confirmAction();
    }
    this.closeConfirm();
  }

}
