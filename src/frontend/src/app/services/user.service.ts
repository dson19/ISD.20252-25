import { HttpClient } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../app.config';

export interface UserRecord {
  userID: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  roles: { roleID: number; name: string }[];
  auditLogs?: any[];
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string,
  ) {}

  getAll(): Observable<UserRecord[]> {
    return this.http.get<UserRecord[]>(`${this.baseUrl}/api/users`);
  }

  toggleStatus(userId: number, status: string): Observable<UserRecord> {
    return this.http.patch<UserRecord>(`${this.baseUrl}/api/users/${userId}/status`, { status });
  }

  updateRoles(userId: number, roles: string[]): Observable<UserRecord> {
    return this.http.patch<UserRecord>(`${this.baseUrl}/api/users/${userId}/roles`, { roles });
  }

  resetPassword(userId: number): Observable<{ email: string; fullName: string; newPassword: string }> {
    return this.http.post<any>(`${this.baseUrl}/api/auth/reset-password/${userId}`, {});
  }
}
