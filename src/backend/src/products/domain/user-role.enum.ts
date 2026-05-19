export enum UserRole {
  Customer = 'Customer',
  ProductManager = 'ProductManager',
}

export function normalizeUserRole(role?: string): UserRole {
  if (role === UserRole.ProductManager || role === 'Product Manager') {
    return UserRole.ProductManager;
  }

  return UserRole.Customer;
}
