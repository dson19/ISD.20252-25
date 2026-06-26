import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserRecord, CreateUserPayload } from '../../../services/user.service';

interface UserAuditLog {
  logID: number;
  action: string;
  description: string;
  performedBy: string;
  createdAt: string;
}

type User = UserRecord & { auditLogs?: UserAuditLog[] };

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

  get totalUsersCount(): number { return this.users.length; }
  get activeUsersCount(): number { return this.users.filter(u => u.status === 'ACTIVE').length; }
  get lockedUsersCount(): number { return this.users.filter(u => u.status === 'DEACTIVATED').length; }
  get adminUsersCount(): number { return this.users.filter(u => u.roles?.some(r => r.name === 'ADMIN')).length; }

  expandedUserIds = new Set<number>();

  isRolesModalOpen = false;
  selectedUserForRoles: User | null = null;
  availableRoles = ['ADMIN', 'PRODUCT_MANAGER', 'STAFF'];
  selectedRolesMap: { [key: string]: boolean } = {};

  isCreateModalOpen = false;
  newUserForm = { email: '', fullName: '', phoneNumber: '', password: '' };
  newUserRolesMap: { [key: string]: boolean } = {};
  isCreatingUser = false;

  isResetPwdModalOpen = false;
  resetPwdResult: { email: string; fullName: string; newPassword?: string } | null = null;

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
    private readonly userService: UserService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.fetchUsers();
  }

  fetchUsers() {
    this.isLoading = true;
    this.userService.getAll().subscribe({
      next: (data) => {
        this.users = data;
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
    this.filteredUsers = this.users.filter((user) => {
      const matchesSearch =
        !query ||
        user.fullName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        String(user.userID).includes(query);
      const matchesRole =
        !this.roleFilter ||
        user.roles?.some((r) => r.name === this.roleFilter);
      const matchesStatus =
        !this.statusFilter || user.status === this.statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  clearFilters() {
    this.searchQuery = '';
    this.roleFilter = '';
    this.statusFilter = '';
    this.applyFilter();
  }

  toggleUserStatus(user: User) {
    const newStatus = user.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    const actionText = newStatus === 'ACTIVE' ? 'unlock' : 'lock';

    this.showConfirm(
      'Confirm Status Change',
      `Are you sure you want to ${actionText} the account [${user.email}]?`,
      newStatus === 'ACTIVE' ? 'info' : 'warning',
      () => {
        this.userService.toggleStatus(user.userID, newStatus).subscribe({
          next: (updatedUser) => {
            user.status = updatedUser.status;
            this.fetchUsers();
            this.showAlert('Success', `Successfully ${actionText}ed the account [${user.email}].`, 'success');
          },
          error: (err) => {
            this.showAlert('Action Failed', err.error?.message || `Unable to ${actionText} the account`, 'error');
          },
        });
      },
    );
  }

  toggleAuditLogs(userID: number) {
    if (this.expandedUserIds.has(userID)) {
      this.expandedUserIds.delete(userID);
    } else {
      this.expandedUserIds.add(userID);
    }
  }

  openCreateModal() {
    this.newUserForm = { email: '', fullName: '', phoneNumber: '', password: '' };
    this.newUserRolesMap = {};
    this.availableRoles.forEach((role) => (this.newUserRolesMap[role] = false));
    this.isCreateModalOpen = true;
  }

  closeCreateModal() {
    this.isCreateModalOpen = false;
  }

  saveNewUser() {
    const email = this.newUserForm.email.trim();
    const fullName = this.newUserForm.fullName.trim();
    const password = this.newUserForm.password;
    const roles = Object.keys(this.newUserRolesMap).filter((r) => this.newUserRolesMap[r]);

    if (!email || !fullName || !password) {
      this.showAlert('Warning', 'Please fill in email, full name and password', 'warning');
      return;
    }
    if (password.length < 6) {
      this.showAlert('Warning', 'Password must be at least 6 characters', 'warning');
      return;
    }
    if (roles.length === 0) {
      this.showAlert('Warning', 'Please select at least one role', 'warning');
      return;
    }

    const payload: CreateUserPayload = {
      email,
      fullName,
      phoneNumber: this.newUserForm.phoneNumber.trim() || undefined,
      password,
      roles,
    };

    this.isCreatingUser = true;
    this.userService.create(payload).subscribe({
      next: () => {
        this.isCreatingUser = false;
        this.closeCreateModal();
        this.fetchUsers();
        this.showAlert('Success', `Account [${email}] created successfully.`, 'success');
      },
      error: (err) => {
        this.isCreatingUser = false;
        const msg = Array.isArray(err.error?.message) ? err.error.message.join(', ') : err.error?.message;
        this.showAlert('Create Failed', msg || 'Unable to create user', 'error');
      },
    });
  }

  openRolesModal(user: User, event: Event) {
    event.stopPropagation();
    this.selectedUserForRoles = user;
    this.selectedRolesMap = {};
    this.availableRoles.forEach((role) => {
      this.selectedRolesMap[role] = user.roles?.some((r) => r.name === role) ?? false;
    });
    this.isRolesModalOpen = true;
  }

  closeRolesModal() {
    this.isRolesModalOpen = false;
    this.selectedUserForRoles = null;
  }

  saveRoles() {
    if (!this.selectedUserForRoles) return;

    const chosenRoles = Object.keys(this.selectedRolesMap).filter((r) => this.selectedRolesMap[r]);
    if (chosenRoles.length === 0) {
      this.showAlert('Warning', 'Please select at least one role for the user', 'warning');
      return;
    }

    this.userService.updateRoles(this.selectedUserForRoles.userID, chosenRoles).subscribe({
      next: () => {
        this.closeRolesModal();
        this.fetchUsers();
        this.showAlert('Update Successful', 'User roles updated successfully.', 'success');
      },
      error: (err) => {
        this.showAlert('Update Error', err.error?.message || 'Unable to update user roles', 'error');
      },
    });
  }

  resetPassword(user: User, event: Event) {
    event.stopPropagation();
    this.showConfirm(
      'Confirm Password Reset',
      `Are you sure you want to reset the password for [${user.email}]? A new temporary password will be randomly generated.`,
      'warning',
      () => {
        this.userService.resetPassword(user.userID).subscribe({
          next: (res) => {
            this.resetPwdResult = { email: res.email, fullName: res.fullName, newPassword: res.newPassword };
            this.isResetPwdModalOpen = true;
            this.fetchUsers();
          },
          error: (err) => {
            this.showAlert('Reset Failed', err.error?.message || 'Unable to reset user password', 'error');
          },
        });
      },
    );
  }

  closeResetPwdModal() {
    this.isResetPwdModalOpen = false;
    this.resetPwdResult = null;
  }

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
    if (this.confirmAction) this.confirmAction();
    this.closeConfirm();
  }
}
