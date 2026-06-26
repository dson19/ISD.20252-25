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

export interface CreateUserPayload {
  email: string;
  fullName: string;
  phoneNumber?: string;
  password: string;
  roles: string[];
}

export interface UserLogRecord {
  logID: number;
  action: string;
  description?: string | null;
  performedBy?: string | null;
  createdAt: string;
  user?: { userID: number; email: string; fullName: string } | null;
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

  create(payload: CreateUserPayload): Observable<UserRecord> {
    return this.http.post<UserRecord>(`${this.baseUrl}/api/users`, payload);
  }

  getLogs(): Observable<UserLogRecord[]> {
    return this.http.get<UserLogRecord[]>(`${this.baseUrl}/api/users/logs`);
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
