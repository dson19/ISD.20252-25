import { Routes } from '@angular/router';

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
        path: 'order-success',
        loadComponent: () => import('./pages/customer/order-success/order-success.component').then(m => m.OrderSuccessComponent)
      }
    ]
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./layout/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
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
        path: 'users',
        loadComponent: () => import('./pages/admin/users/users.component').then(m => m.UsersComponent)
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
