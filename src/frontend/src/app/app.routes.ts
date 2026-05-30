import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/customer-layout/customer-layout.component').then(m => m.CustomerLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/customer/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'product/:id',
        loadComponent: () => import('./pages/customer/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
      },
      {
        path: 'cart',
        loadComponent: () => import('./pages/customer/cart/cart.component').then(m => m.CartComponent)
      },
      {
        path: 'checkout',
        loadComponent: () => import('./pages/customer/checkout/checkout.component').then(m => m.CheckoutComponent)
      },
      {
        path: 'invoice',
        loadComponent: () => import('./pages/customer/invoice/invoice.component').then(m => m.InvoiceComponent)
      },
      {
        path: 'payment',
        loadComponent: () => import('./pages/customer/payment/payment.component').then(m => m.PaymentComponent)
      },
      {
        path: 'payment-result',
        loadComponent: () => import('./pages/customer/payment-result/payment-result.component').then(m => m.PaymentResultComponent)
      },
      {
        path: 'order-detail',
        loadComponent: () => import('./pages/customer/order-detail/order-detail.component').then(m => m.OrderDetailComponent)
      }
    ]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/admin/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./layout/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'users',
        loadComponent: () => import('./pages/admin/users/users.component').then(m => m.UsersComponent)
      },
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'pm',
    loadComponent: () => import('./layout/pm-layout/pm-layout.component').then(m => m.PmLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'orders',
        loadComponent: () => import('./pages/admin/orders/orders.component').then(m => m.OrdersComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/admin/products/products.component').then(m => m.ProductsComponent)
      },
      {
        path: 'logs',
        loadComponent: () => import('./pages/admin/logs/logs.component').then(m => m.LogsComponent)
      },
      {
        path: '',
        redirectTo: 'orders',
        pathMatch: 'full'
      }
    ]
  }
];
