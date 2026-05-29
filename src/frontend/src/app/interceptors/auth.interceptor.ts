import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('aims_token');
  let user: any = null;

  if (token) {
    try {
      const payload = token.split('.')[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      user = JSON.parse(jsonPayload);
    } catch (e) {
      user = null;
    }
  }

  let clonedReq = req;

  if (token) {
    let headers = req.headers.set('Authorization', `Bearer ${token}`);
    
    // If user has PRODUCT_MANAGER role, automatically append 'x-manager-id' header
    if (user && user.roles && user.roles.includes('PRODUCT_MANAGER')) {
      headers = headers.set('x-manager-id', user.email);
    }
    
    clonedReq = req.clone({ headers });
  }

  return next(clonedReq);
};

