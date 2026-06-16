import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '../app.config';

export interface CdTrack {
  id?: number;
  title: string;
  lengthSeconds: number;
}

export interface ProductMediaDetail {
  publisher?: string | null;
  language?: string | null;
  releaseDate?: string | null;
  genre?: string | null;
}

export function getProductType(product?: { productType?: string | null; mediaType?: string | null } | null): string {
  return product?.productType ?? product?.mediaType ?? 'PRODUCT';
}

export function productTypeLabel(productType?: string | null): string {
  const labels: Record<string, string> = {
    BOOK: 'Sách',
    NEWSPAPER: 'Báo chí',
    CD: 'CD',
    DVD: 'DVD',
  };

  return productType ? (labels[productType] ?? productType) : 'Sản phẩm';
}

export interface Product {
  productID: number;
  mediaType: 'BOOK' | 'CD' | 'DVD' | 'NEWSPAPER' | string;
  productType?: 'BOOK' | 'CD' | 'DVD' | 'NEWSPAPER' | string;
  title: string;
  category: string;
  description?: string | null;
  barcode: string;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight: number;
  originalPrice: number | string;
  currentPrice: number | string;
  quantityInStock: number;
  status: string;
  imageUrl?: string | null;
  book?: {
    productID: number;
    authors: string;
    coverType: string;
    publisher: string;
    publicationDate: string;
    releaseDate?: string | null;
    numPages?: number | null;
    numberOfPages?: number | null;
    language?: string | null;
    genre?: string | null;
    media?: ProductMediaDetail | null;
  } | null;
  newspaper?: {
    productID: number;
    editorInChief: string;
    publisher: string;
    publicationDate: string;
    releaseDate?: string | null;
    issueNumber?: string | null;
    frequency?: string | null;
    publicationFrequency?: string | null;
    issn?: string | null;
    language?: string | null;
    sections?: string | null;
    media?: ProductMediaDetail | null;
  } | null;
  cd?: {
    productID: number;
    artists: string;
    recordLabel: string;
    publisher?: string | null;
    genre: string;
    releaseDate?: string | null;
    tracks?: CdTrack[];
    media?: ProductMediaDetail | null;
  } | null;
  dvd?: {
    productID: number;
    discType: string;
    director: string;
    runtimeMinutes: number;
    runtime?: number | null;
    studio: string;
    publisher?: string | null;
    language: string;
    subtitles: string;
    releaseDate?: string | null;
    genre?: string | null;
    media?: ProductMediaDetail | null;
  } | null;
}

export interface ProductSearchParams {
  keyword?: string;
  category?: string;
  mediaTypes?: string[];
  minPrice?: number;
  maxPrice?: number;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(
    private http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string
  ) {}

  getRandomProducts(): Observable<Product[]> {
    return this.http
      .get<Product[]>(`${this.baseUrl}/api/products/random`)
      .pipe(map((products) => this.normalizeProducts(products)));
  }

  searchProducts(params: ProductSearchParams): Observable<Product[]> {
    let httpParams = new HttpParams();
    if (params.keyword?.trim()) {
      httpParams = httpParams.set('keyword', params.keyword.trim());
    }
    if (params.category) {
      httpParams = httpParams.set('category', params.category);
    }
    if (params.mediaTypes?.length) {
      httpParams = httpParams.set('mediaTypes', params.mediaTypes.join(','));
    }
    if (params.minPrice !== undefined) {
      httpParams = httpParams.set('minPrice', params.minPrice);
    }
    if (params.maxPrice !== undefined) {
      httpParams = httpParams.set('maxPrice', params.maxPrice);
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }

    return this.http
      .get<Product[]>(`${this.baseUrl}/api/products`, { params: httpParams })
      .pipe(map((products) => this.normalizeProducts(products)));
  }

  getProductById(id: number): Observable<Product> {
    return this.http
      .get<Product>(`${this.baseUrl}/api/products/${id}`)
      .pipe(map((product) => this.normalizeProduct(product)));
  }

  createProduct(dto: any): Observable<Product> {
    return this.http
      .post<Product>(`${this.baseUrl}/api/products`, dto)
      .pipe(map((product) => this.normalizeProduct(product)));
  }

  updateProduct(id: number, dto: any): Observable<Product> {
    return this.http
      .patch<Product>(`${this.baseUrl}/api/products/${id}`, dto)
      .pipe(map((product) => this.normalizeProduct(product)));
  }

  adjustStock(id: number, quantityDelta: number, reason: string): Observable<Product> {
    return this.http
      .patch<Product>(`${this.baseUrl}/api/products/${id}/stock`, {
        quantityDelta,
        reason
      })
      .pipe(map((product) => this.normalizeProduct(product)));
  }

  deleteProducts(ids: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/products/batch-delete`, { ids });
  }

  deactivateProducts(ids: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/products/batch-deactivate`, { ids });
  }

  getAuditLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/products/audit-logs`);
  }

  private normalizeProducts(products: Product[]): Product[] {
    return products.map((product) => this.normalizeProduct(product));
  }

  private normalizeProduct(product: Product): Product {
    const productType = getProductType(product);
    return {
      ...product,
      productType,
      mediaType: productType,
    };
  }
}
