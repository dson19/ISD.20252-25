import { ProductStatus } from './product-status.enum';
import { UserRole } from './user-role.enum';

export type ProductSpecifications = Readonly<Record<string, unknown>>;

export type ProductDTO = Readonly<{
  productID: number;
  title: string;
  category: string;
  description: string;
  barcode: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  originalValue: number;
  currentPrice: number;
  quantityInStock: number;
  status: ProductStatus;
  imageUrl: string;
  specifications: ProductSpecifications;
}>;

export type ProductProps = Readonly<{
  productID: number;
  title: string;
  category: string;
  description: string;
  barcode: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  originalValue: number;
  currentPrice: number;
  quantityInStock: number;
  status: ProductStatus;
  imageUrl: string;
  specifications?: ProductSpecifications;
}>;

export class Product {
  constructor(private readonly props: ProductProps) {}

  get productID(): number {
    return this.props.productID;
  }

  get status(): ProductStatus {
    return this.props.status;
  }

  isViewableBy(role: UserRole): boolean {
    return (
      this.props.status === ProductStatus.Active ||
      role === UserRole.ProductManager
    );
  }

  toDTO(): ProductDTO {
    return {
      productID: this.props.productID,
      title: this.props.title,
      category: this.props.category,
      description: this.props.description,
      barcode: this.props.barcode,
      length: this.props.length,
      width: this.props.width,
      height: this.props.height,
      weight: this.props.weight,
      originalValue: this.props.originalValue,
      currentPrice: this.props.currentPrice,
      quantityInStock: this.props.quantityInStock,
      status: this.props.status,
      imageUrl: this.props.imageUrl,
      specifications: { ...(this.props.specifications ?? {}) },
    };
  }
}
