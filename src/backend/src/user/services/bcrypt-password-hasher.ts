import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { IPasswordHasher } from '../interfaces/password-hasher.interface';

/**
 * bcrypt-based implementation of IPasswordHasher.
 *
 * Functional cohesion: every method here is dedicated to password credential
 * handling (hashing + secure temporary-password generation).
 */
@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly saltRounds = 10;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  generateTemporaryPassword(length = 12): string {
    // Use crypto-grade randomness instead of Math.random for security-sensitive temp passwords.
    return randomBytes(length)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, length);
  }
}
