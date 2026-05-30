import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-pm-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './pm-layout.component.html'
})
export class PmLayoutComponent {
  // Profile dropdown and modals state
  isProfileDropdownOpen = false;
  isUserInfoModalOpen = false;
  isChangePasswordModalOpen = false;

  // Change password fields
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  pwdErrorMessage = '';
  pwdSuccessMessage = '';
  pwdLoading = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  logout(event: Event) {
    event.preventDefault();
    this.isProfileDropdownOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleProfileDropdown(event: Event) {
    event.stopPropagation();
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }

  openUserInfoModal(event: Event) {
    event.preventDefault();
    this.isUserInfoModalOpen = true;
    this.isProfileDropdownOpen = false;
  }

  closeUserInfoModal() {
    this.isUserInfoModalOpen = false;
  }

  openChangePasswordModal(event: Event) {
    event.preventDefault();
    this.isChangePasswordModalOpen = true;
    this.isProfileDropdownOpen = false;
    this.oldPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.pwdErrorMessage = '';
    this.pwdSuccessMessage = '';
  }

  closeChangePasswordModal() {
    this.isChangePasswordModalOpen = false;
  }

  submitChangePassword() {
    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      this.pwdErrorMessage = 'Vui lòng điền đầy đủ các trường';
      return;
    }
    if (this.newPassword.length < 6) {
      this.pwdErrorMessage = 'Mật khẩu mới phải có tối thiểu 6 ký tự';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.pwdErrorMessage = 'Xác nhận mật khẩu mới không khớp';
      return;
    }

    this.pwdLoading = true;
    this.pwdErrorMessage = '';
    this.pwdSuccessMessage = '';

    this.authService.changePassword(this.oldPassword, this.newPassword).subscribe({
      next: (res) => {
        this.pwdLoading = false;
        this.pwdSuccessMessage = 'Đổi mật khẩu thành công!';
        setTimeout(() => {
          this.closeChangePasswordModal();
        }, 1500);
      },
      error: (err) => {
        this.pwdLoading = false;
        this.pwdErrorMessage = err.error?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.';
      }
    });
  }
}
