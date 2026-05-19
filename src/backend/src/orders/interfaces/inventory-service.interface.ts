export interface InventoryService {
  hasEnoughStock(productId: string, quantity: number): boolean | Promise<boolean>;
  reserveStock(productId: string, quantity: number): void | Promise<void>;
}
