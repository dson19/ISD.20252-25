import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const url = state.url;
  if (url.startsWith('/admin')) {
    if (!authService.hasRole('ADMIN')) {
      if (authService.hasRole('PRODUCT_MANAGER')) {
        router.navigate(['/pm/orders']);
      } else {
        router.navigate(['/login']);
      }
      return false;
    }
  }

  if (url.startsWith('/pm')) {
    if (!authService.hasRole('PRODUCT_MANAGER')) {
      if (authService.hasRole('ADMIN')) {
        router.navigate(['/admin/users']);
      } else {
        router.navigate(['/login']);
      }
      return false;
    }
  }

  return true;
};
