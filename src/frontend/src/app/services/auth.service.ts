import { HttpClient } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { API_BASE_URL } from '../app.config';

export interface UserPayload {
  userID: number;
  email: string;
  fullName: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<UserPayload | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string
  ) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage() {
    const token = localStorage.getItem('aims_token');
    if (token) {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        this.userSubject.next(decoded);
      } else {
        this.logout();
      }
    }
  }

  login(email: string, pass: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/auth/login`, { email, password: pass }).pipe(
      tap((res) => {
        if (res.token) {
          localStorage.setItem('aims_token', res.token);
          const decoded = this.decodeToken(res.token);
          this.userSubject.next(decoded);
        }
      })
    );
  }

  changePassword(oldPass: string, newPass: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/auth/change-password`, {
      oldPassword: oldPass,
      newPassword: newPass
    });
  }

  logout() {
    localStorage.removeItem('aims_token');
    this.userSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('aims_token');
  }

  getCurrentUser(): UserPayload | null {
    return this.userSubject.value;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.roles.includes(role) : false;
  }

  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    return !!user;
  }

  decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }
}
