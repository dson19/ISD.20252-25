import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './admin-layout.component.html'
})
export class AdminLayoutComponent {
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

  get isPM(): boolean {
    return this.authService.hasRole('PRODUCT_MANAGER');
  }

  switchToPM(event: Event) {
    event.preventDefault();
    this.isProfileDropdownOpen = false;
    this.router.navigate(['/pm/orders']);
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
      this.pwdErrorMessage = 'Please fill in all fields';
      return;
    }
    if (this.newPassword.length < 6) {
      this.pwdErrorMessage = 'New password must be at least 6 characters';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.pwdErrorMessage = 'New password confirmation does not match';
      return;
    }

    this.pwdLoading = true;
    this.pwdErrorMessage = '';
    this.pwdSuccessMessage = '';

    this.authService.changePassword(this.oldPassword, this.newPassword).subscribe({
      next: (res) => {
        this.pwdLoading = false;
        this.pwdSuccessMessage = 'Password changed successfully!';
        setTimeout(() => {
          this.closeChangePasswordModal();
        }, 1500);
      },
      error: (err) => {
        this.pwdLoading = false;
        this.pwdErrorMessage = err.error?.message || 'Failed to change password. Please check your old password.';
      }
    });
  }
}
