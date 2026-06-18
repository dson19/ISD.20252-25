/**
 * Abstraction for password hashing & temporary-password generation.
 *
 * DIP: high-level UserAdminService depends on this interface, not on the concrete
 * bcrypt library. Swapping the hashing algorithm (argon2, scrypt, ...) only requires
 * a new implementation registered under the PASSWORD_HASHER token — no service change.
 */
export interface IPasswordHasher {
  /** One-way hash a plaintext password. */
  hash(plain: string): Promise<string>;
  /** Generate a cryptographically-random temporary password. */
  generateTemporaryPassword(length?: number): string;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
