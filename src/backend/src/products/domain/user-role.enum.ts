export enum UserRole {
  Customer = 'Customer',
  ProductManager = 'Product Manager',
}

export function normalizeUserRole(role?: string): UserRole {
  if (role === UserRole.ProductManager || role === 'ProductManager') {
    return UserRole.ProductManager;
  }

  return UserRole.Customer;
}
