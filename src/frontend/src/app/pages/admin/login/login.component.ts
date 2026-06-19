import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      if (user) {
        if (user.roles.includes('ADMIN')) {
          this.router.navigate(['/admin/users']);
        } else if (user.roles.includes('PRODUCT_MANAGER')) {
          this.router.navigate(['/pm/orders']);
        } else {
          this.router.navigate(['/pm/orders']);
        }
      }
    }
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        const user = this.authService.getCurrentUser();
        if (user) {
          if (user.roles.includes('ADMIN')) {
            this.router.navigate(['/admin/users']);
          } else if (user.roles.includes('PRODUCT_MANAGER')) {
            this.router.navigate(['/pm/orders']);
          } else {
            this.router.navigate(['/pm/orders']);
          }
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Login failed. Please check your credentials.';
        this.cdr.detectChanges();
      }
    });
  }
}
