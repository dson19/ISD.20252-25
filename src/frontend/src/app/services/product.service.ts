import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../app.config';

export interface CdTrack {
  id?: number;
  title: string;
  lengthSeconds: number;
}

export interface Product {
  productID: number;
  mediaType: 'BOOK' | 'CD' | 'DVD' | 'NEWSPAPER' | string;
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
    numPages?: number | null;
    language?: string | null;
    genre?: string | null;
  } | null;
  newspaper?: {
    productID: number;
    editorInChief: string;
    publisher: string;
    publicationDate: string;
    issueNumber?: string | null;
    frequency?: string | null;
    issn?: string | null;
    language?: string | null;
    sections?: string | null;
  } | null;
  cd?: {
    productID: number;
    artists: string;
    recordLabel: string;
    genre: string;
    releaseDate?: string | null;
    tracks?: CdTrack[];
  } | null;
  dvd?: {
    productID: number;
    discType: string;
    director: string;
    runtimeMinutes: number;
    studio: string;
    language: string;
    subtitles: string;
    releaseDate?: string | null;
    genre?: string | null;
  } | null;
}

export interface ProductSearchParams {
  keyword?: string;
  category?: string;
  mediaTypes?: string[];
  minPrice?: number;
  maxPrice?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(
    private http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string
  ) {}

  getRandomProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/api/products/random`);
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

    return this.http.get<Product[]>(`${this.baseUrl}/api/products`, { params: httpParams });
  }

  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/api/products/${id}`);
  }

  createProduct(dto: any): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/api/products`, dto);
  }

  updateProduct(id: number, dto: any): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/api/products/${id}`, dto);
  }

  adjustStock(id: number, quantityDelta: number, reason: string): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/api/products/${id}/stock`, {
      quantityDelta,
      reason
    });
  }

  deleteProducts(ids: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/products/batch-delete`, { ids });
  }

  getAuditLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/products/audit-logs`);
  }
}
