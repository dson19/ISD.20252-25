import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product, ProductSearchParams } from '../../../services/product.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html'
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  isLoading = false;
  totalDatabaseProductsCount = 0;

  // Pagination
  currentPage = 1;
  pageSize = 10;

  // Search & Filter
  keyword = '';
  category = '';
  mediaTypesFilter = '';
  statusFilter = '';

  // Checkbox management for batch operations
  selectedProducts: { [key: number]: boolean } = {};
  isAllSelected = false;

  // Modals visibility toggles
  isProductModalOpen = false;
  isStockModalOpen = false;

  // Stock Adjustment State
  selectedProductForStock: Product | null = null;
  stockDelta = 1;
  stockReason = '';
  stockActionType: 'IMPORT' | 'EXPORT' = 'IMPORT';
  selectedPredefinedReason = 'Restock from supplier';
  customStockReason = '';

  // Form State
  isEditMode = false;
  editingProductId: number | null = null;
  errorMessage = '';
  loadingProductId: number | null = null;

  // Custom alert & confirm states
  isConfirmModalOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'info' | 'warning' = 'warning';
  confirmAction: (() => void) | null = null;

  isAlertModalOpen = false;
  alertTitle = '';
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' | 'warning' = 'info';
  alertDetails: string[] = [];

  showConfirm(title: string, message: string, type: 'danger' | 'info' | 'warning', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.confirmAction = action;
    this.isConfirmModalOpen = true;
    this.cdr.detectChanges();
  }

  closeConfirm() {
    this.isConfirmModalOpen = false;
    this.confirmAction = null;
    this.cdr.detectChanges();
  }

  triggerConfirmAction() {
    if (this.confirmAction) {
      this.confirmAction();
    }
    this.closeConfirm();
  }

  showAlert(title: string, message: string, type: 'success' | 'error' | 'info' | 'warning', details: string[] = []) {
    this.alertTitle = title;
    this.alertMessage = message;
    this.alertType = type;
    this.alertDetails = details;
    this.isAlertModalOpen = true;
    this.cdr.detectChanges();
  }

  closeAlert() {
    this.isAlertModalOpen = false;
    this.alertDetails = [];
    this.cdr.detectChanges();
  }

  // Master DTO structure matching CreateProductDto
  productForm: any = {
    mediaType: 'BOOK',
    title: '',
    category: '',
    description: '',
    barcode: '',
    length: null,
    width: null,
    height: null,
    weight: 0,
    originalPrice: 0,
    currentPrice: 0,
    quantityInStock: 0,
    imageUrl: '',
    status: 'ACTIVE',
    
    // Type specific sub-objects
    book: {
      authors: '',
      coverType: 'Hardcover',
      publisher: '',
      publicationDate: '',
      numPages: null,
      language: 'Vietnamese',
      genre: ''
    },
    cd: {
      artists: '',
      recordLabel: '',
      genre: '',
      tracks: []
    },
    dvd: {
      discType: 'DVD-9',
      director: '',
      runtimeMinutes: 120,
      studio: '',
      language: 'Vietnamese',
      subtitles: 'Vietnamese'
    },
    newspaper: {
      editorInChief: '',
      publisher: '',
      publicationDate: ''
    }
  };

  constructor(
    private readonly productService: ProductService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  formatPriceInput(value: string | number): string {
    if (value === undefined || value === null || value === '') return '';
    const clean = String(value).replace(/\D/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  onOriginalPriceChange(val: string) {
    const formatted = this.formatPriceInput(val);
    this.productForm.originalPrice = formatted;
  }

  onCurrentPriceChange(val: string) {
    const formatted = this.formatPriceInput(val);
    this.productForm.currentPrice = formatted;
  }

  parsePrice(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const clean = val.replace(/\./g, '');
      return Number(clean) || 0;
    }
    return 0;
  }

  normalizeDate(val: string): string | null {
    if (!val) return null;
    const trimmed = String(val).trim();
    
    // Check YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    
    // Check DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }

    // Check DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('-');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    
    return null;
  }

  onMediaTypeChange(type: string) {
    if (this.isEditMode) return;
    if (type === 'BOOK') this.productForm.category = 'Books';
    else if (type === 'CD') this.productForm.category = 'CD';
    else if (type === 'DVD') this.productForm.category = 'DVD';
    else if (type === 'NEWSPAPER') this.productForm.category = 'Newspaper';
  }

  ngOnInit() {
    this.fetchProducts();
    this.fetchTotalProductsCount();
  }

  fetchTotalProductsCount() {
    this.productService.searchProducts({ status: 'ALL' }).subscribe({
      next: (data) => {
        this.totalDatabaseProductsCount = data.length;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching total product count:', err);
      }
    });
  }

  fetchProducts() {
    this.isLoading = true;
    console.log('[ProductsComponent] fetchProducts() fetching products...');
    
    const params: ProductSearchParams = {
      keyword: this.keyword,
      category: this.category,
      mediaTypes: this.mediaTypesFilter ? [this.mediaTypesFilter] : undefined,
      status: 'ALL'
    };
    
    console.log('[ProductsComponent] fetchProducts() params:', params);
    console.log('[ProductsComponent] Token trong localStorage:', localStorage.getItem('aims_token'));

    this.productService.searchProducts(params).subscribe({
      next: (data) => {
        console.log('[ProductsComponent] fetchProducts() received data:', data);
        // Enforce frontend status filter client-side if selected
        if (this.statusFilter) {
          this.products = data.filter(p => p.status === this.statusFilter);
        } else {
          this.products = data;
        }
        
        // Reset to page 1 on new fetch
        this.currentPage = 1;

        // Clear checkboxes
        this.selectedProducts = {};
        this.isAllSelected = false;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[ProductsComponent] fetchProducts() error fetching products:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFilterChange() {
    this.fetchProducts();
  }

  // Row selection checkbox logic
  toggleSelectAll() {
    this.paginatedProducts.forEach((p) => {
      this.selectedProducts[p.productID] = this.isAllSelected;
    });
  }

  onRowSelectChange() {
    const visible = this.paginatedProducts;
    this.isAllSelected = visible.length > 0 && visible.every(p => this.selectedProducts[p.productID]);
  }

  getSelectedCount(): number {
    return Object.keys(this.selectedProducts).filter((id) => this.selectedProducts[+id]).length;
  }

  // Dashboard Metrics Getters
  get totalProductsCount(): number {
    return this.totalDatabaseProductsCount;
  }

  get activeProductsCount(): number {
    return this.products.filter((p) => p.status === 'ACTIVE').length;
  }

  get deactivatedCount(): number {
    return this.products.filter((p) => p.status === 'DEACTIVATED').length;
  }

  // Pagination Getters & Methods
  get totalPages(): number {
    return Math.ceil(this.products.length / this.pageSize);
  }

  get paginatedProducts(): Product[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.products.slice(start, start + this.pageSize);
  }

  get pageStart(): number {
    if (this.products.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.products.length);
  }

  get visiblePages(): (number | string)[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (current > 3) {
        pages.push('...');
      }

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 2) {
        pages.push('...');
      }

      pages.push(total);
    }

    return pages;
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.isAllSelected = false;
    this.selectedProducts = {};
  }

  changePage(page: number | string) {
    if (typeof page === 'number') {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
        // Clear current select all checkbox state when changing page
        this.isAllSelected = this.paginatedProducts.length > 0 && this.paginatedProducts.every(p => this.selectedProducts[p.productID]);
      }
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.changePage(this.currentPage - 1);
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.changePage(this.currentPage + 1);
    }
  }

  // Stock Adjustment Methods
  openStockModal(product: Product) {
    this.selectedProductForStock = product;
    this.stockDelta = 1;
    this.stockActionType = 'IMPORT';
    this.selectedPredefinedReason = 'Restock from supplier';
    this.customStockReason = '';
    this.stockReason = '';
    this.isStockModalOpen = true;
    this.cdr.detectChanges();
  }

  closeStockModal() {
    this.isStockModalOpen = false;
    this.selectedProductForStock = null;
    this.cdr.detectChanges();
  }

  onStockActionTypeChange() {
    if (this.stockActionType === 'IMPORT') {
      this.selectedPredefinedReason = 'Restock from supplier';
    } else {
      this.selectedPredefinedReason = 'Damaged / defective goods';
    }
  }

  getNewStock(): number {
    if (!this.selectedProductForStock) return 0;
    const actualDelta = this.stockActionType === 'IMPORT' ? this.stockDelta : -this.stockDelta;
    return Math.max(0, this.selectedProductForStock.quantityInStock + actualDelta);
  }

  saveStockAdjustment() {
    if (!this.selectedProductForStock) return;
    
    if (this.stockDelta <= 0 || !Number.isInteger(this.stockDelta)) {
      this.showAlert('Notice', 'Please enter a valid quantity (> 0)', 'warning');
      return;
    }

    const actualDelta = this.stockActionType === 'IMPORT' ? this.stockDelta : -this.stockDelta;
    if (this.stockActionType === 'EXPORT' && this.stockDelta > this.selectedProductForStock.quantityInStock) {
      this.showAlert(
        'Exceeds Stock Quantity',
        `Cannot export more than the available stock (Current stock: ${this.selectedProductForStock.quantityInStock} items).`,
        'warning'
      );
      return;
    }

    const actualReason = this.selectedPredefinedReason === 'Other'
      ? this.customStockReason.trim()
      : this.selectedPredefinedReason;

    if (!actualReason) {
      this.showAlert('Missing Information', 'Please select or enter a stock adjustment reason', 'warning');
      return;
    }

    this.productService
      .adjustStock(this.selectedProductForStock.productID, actualDelta, actualReason)
      .subscribe({
        next: (updatedProduct) => {
          this.closeStockModal();
          this.fetchProducts();
          this.fetchTotalProductsCount();
        },
        error: (err) => {
          this.showAlert('Adjustment Error', err.error?.message || 'Unable to adjust stock', 'error');
        }
      });
  }

  // Form Modals Creation & Edits
  openCreateModal() {
    this.isEditMode = false;
    this.editingProductId = null;
    this.errorMessage = '';
    
    // Reset Form to initial empty template
    this.productForm = {
      mediaType: 'BOOK',
      title: '',
      category: '',
      description: '',
      barcode: '',
      length: null,
      width: null,
      height: null,
      weight: 0,
      originalPrice: 0,
      currentPrice: 0,
      quantityInStock: 0,
      imageUrl: '',
      status: 'ACTIVE',
      book: {
        authors: '',
        coverType: 'Paperback',
        publisher: '',
        publicationDate: '',
        numPages: null,
        language: 'Vietnamese',
        genre: ''
      },
      cd: {
        artists: '',
        recordLabel: '',
        genre: '',
        tracks: []
      },
      dvd: {
        discType: 'DVD-9',
        director: '',
        runtimeMinutes: 120,
        studio: '',
        language: 'Vietnamese',
        subtitles: 'Vietnamese'
      },
      newspaper: {
        editorInChief: '',
        publisher: '',
        publicationDate: ''
      }
    };

    this.isProductModalOpen = true;
    this.cdr.detectChanges();
  }

  openEditModal(product: Product) {
    if (this.loadingProductId !== null) return;
    
    this.isEditMode = true;
    this.editingProductId = product.productID;
    this.errorMessage = '';
    this.loadingProductId = product.productID;
    this.cdr.detectChanges();

    this.productService.getProductById(product.productID).subscribe({
      next: (fullProduct) => {
        // Prepopulate form fields
        this.productForm = {
          mediaType: fullProduct.mediaType,
          title: fullProduct.title,
          category: fullProduct.category,
          description: fullProduct.description || '',
          barcode: fullProduct.barcode,
          length: fullProduct.length,
          width: fullProduct.width,
          height: fullProduct.height,
          weight: fullProduct.weight,
          originalPrice: this.formatPriceInput(Math.round(Number(fullProduct.originalPrice))),
          currentPrice: this.formatPriceInput(Math.round(Number(fullProduct.currentPrice))),
          quantityInStock: fullProduct.quantityInStock,
          imageUrl: fullProduct.imageUrl || '',
          status: fullProduct.status,
          book: fullProduct.book ? {
            ...fullProduct.book,
            publicationDate: fullProduct.book.publicationDate ? String(fullProduct.book.publicationDate).slice(0, 10) : ''
          } : {
            authors: '',
            coverType: 'Paperback',
            publisher: '',
            publicationDate: '',
            numPages: null,
            language: 'Vietnamese',
            genre: ''
          },
          cd: fullProduct.cd || {
            artists: '',
            recordLabel: '',
            genre: '',
            tracks: []
          },
          dvd: fullProduct.dvd || {
            discType: 'DVD-9',
            director: '',
            runtimeMinutes: 120,
            studio: '',
            language: 'Vietnamese',
            subtitles: 'Vietnamese'
          },
          newspaper: fullProduct.newspaper ? {
            ...fullProduct.newspaper,
            publicationDate: fullProduct.newspaper.publicationDate ? String(fullProduct.newspaper.publicationDate).slice(0, 10) : ''
          } : {
            editorInChief: '',
            publisher: '',
            publicationDate: ''
          }
        };

        // Convert nested track objects to dynamic form array
        if (this.productForm.mediaType === 'CD' && !this.productForm.cd.tracks) {
          this.productForm.cd.tracks = [];
        }

        this.isProductModalOpen = true;
        this.loadingProductId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingProductId = null;
        this.cdr.detectChanges();
        this.showAlert('Load Error', err.error?.message || 'Unable to load product details', 'error');
      }
    });
  }

  closeProductModal() {
    this.isProductModalOpen = false;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  // CD Dynamic track listing operations
  addTrack() {
    this.productForm.cd.tracks.push({
      title: '',
      lengthSeconds: 180
    });
  }

  removeTrack(index: number) {
    this.productForm.cd.tracks.splice(index, 1);
  }

  // Validate form before submitting
  validateForm(): boolean {
    if (!this.productForm.title?.trim()) {
      this.errorMessage = 'Title is required';
      return false;
    }
    if (!this.productForm.category?.trim()) {
      this.errorMessage = 'Category is required';
      return false;
    }
    if (!this.productForm.barcode?.trim()) {
      this.errorMessage = 'Barcode is required';
      return false;
    }
    if (this.productForm.weight <= 0) {
      this.errorMessage = 'Weight must be greater than 0';
      return false;
    }
    if (this.productForm.length !== null && this.productForm.length <= 0) {
      this.errorMessage = 'Length must be greater than 0';
      return false;
    }
    if (this.productForm.width !== null && this.productForm.width <= 0) {
      this.errorMessage = 'Width must be greater than 0';
      return false;
    }
    if (this.productForm.height !== null && this.productForm.height <= 0) {
      this.errorMessage = 'Height must be greater than 0';
      return false;
    }
    if (this.productForm.quantityInStock < 0 || !Number.isInteger(this.productForm.quantityInStock)) {
      this.errorMessage = 'Stock quantity must be a non-negative integer';
      return false;
    }

    // Price Ratio validation
    const origPrice = this.parsePrice(this.productForm.originalPrice);
    const currPrice = this.parsePrice(this.productForm.currentPrice);
    if (origPrice <= 0) {
      this.errorMessage = 'Original price must be greater than 0';
      return false;
    }
    if (currPrice < origPrice * 0.3 || currPrice > origPrice * 1.5) {
      this.errorMessage = 'Sale price must be between 30% and 150% of the original price';
      return false;
    }

    // MediaType specific validation
    const type = this.productForm.mediaType;
    if (type === 'BOOK') {
      const book = this.productForm.book;
      if (!book.authors?.trim()) {
        this.errorMessage = 'Book author is required';
        return false;
      }
      if (!book.coverType?.trim()) {
        this.errorMessage = 'Book cover type is required';
        return false;
      }
      if (!book.publisher?.trim()) {
        this.errorMessage = 'Publisher is required';
        return false;
      }
      const pubDate = book.publicationDate;
      if (!pubDate || (typeof pubDate === 'string' && !pubDate.trim())) {
        this.errorMessage = 'Publication date is required';
        return false;
      }
      const normalized = this.normalizeDate(String(pubDate));
      if (!normalized) {
        this.errorMessage = 'Invalid publication date format (expected: YYYY-MM-DD or DD/MM/YYYY)';
        return false;
      }
      book.publicationDate = normalized;
      if (book.numPages !== null && book.numPages <= 0) {
        this.errorMessage = 'Number of pages must be greater than 0';
        return false;
      }
    } else if (type === 'CD') {
      const cd = this.productForm.cd;
      if (!cd.artists?.trim()) {
        this.errorMessage = 'CD artist is required';
        return false;
      }
      if (!cd.recordLabel?.trim()) {
        this.errorMessage = 'CD record label is required';
        return false;
      }
      if (!cd.genre?.trim()) {
        this.errorMessage = 'CD genre is required';
        return false;
      }
      if (!cd.tracks || cd.tracks.length === 0) {
        this.errorMessage = 'CD must have at least one track';
        return false;
      }
      for (let i = 0; i < cd.tracks.length; i++) {
        if (!cd.tracks[i].title?.trim()) {
          this.errorMessage = `Track ${i + 1} title is required`;
          return false;
        }
        if (cd.tracks[i].lengthSeconds <= 0) {
          this.errorMessage = `Track ${i + 1} duration must be greater than 0 seconds`;
          return false;
        }
      }
    } else if (type === 'DVD') {
      const dvd = this.productForm.dvd;
      if (!dvd.discType?.trim()) {
        this.errorMessage = 'DVD disc type is required';
        return false;
      }
      if (!dvd.director?.trim()) {
        this.errorMessage = 'DVD director is required';
        return false;
      }
      if (dvd.runtimeMinutes <= 0) {
        this.errorMessage = 'DVD runtime must be greater than 0 minutes';
        return false;
      }
      if (!dvd.studio?.trim()) {
        this.errorMessage = 'DVD studio is required';
        return false;
      }
      if (!dvd.language?.trim()) {
        this.errorMessage = 'DVD language is required';
        return false;
      }
    } else if (type === 'NEWSPAPER') {
      const np = this.productForm.newspaper;
      if (!np.editorInChief?.trim()) {
        this.errorMessage = 'Newspaper editor-in-chief is required';
        return false;
      }
      if (!np.publisher?.trim()) {
        this.errorMessage = 'Newspaper publisher is required';
        return false;
      }
      const pubDate = np.publicationDate;
      if (!pubDate || (typeof pubDate === 'string' && !pubDate.trim())) {
        this.errorMessage = 'Newspaper publication date is required';
        return false;
      }
      const normalized = this.normalizeDate(String(pubDate));
      if (!normalized) {
        this.errorMessage = 'Invalid newspaper publication date format (expected: YYYY-MM-DD or DD/MM/YYYY)';
        return false;
      }
      np.publicationDate = normalized;
    }

    this.errorMessage = '';
    return true;
  }

  saveProduct() {
    if (!this.validateForm()) return;

    // Assemble dynamic payload consisting of general details and only one matching media sub-object
    const type = this.productForm.mediaType;
    const payload: any = {
      mediaType: type,
      title: this.productForm.title.trim(),
      category: this.productForm.category.trim(),
      description: this.productForm.description ? this.productForm.description.trim() : null,
      barcode: this.productForm.barcode.trim(),
      length: this.productForm.length,
      width: this.productForm.width,
      height: this.productForm.height,
      weight: Number(this.productForm.weight),
      originalPrice: this.parsePrice(this.productForm.originalPrice),
      currentPrice: this.parsePrice(this.productForm.currentPrice),
      quantityInStock: Number(this.productForm.quantityInStock),
      imageUrl: this.productForm.imageUrl ? this.productForm.imageUrl.trim() : null,
      status: this.productForm.status
    };

    if (type === 'BOOK') {
      payload.book = { ...this.productForm.book };
    } else if (type === 'CD') {
      payload.cd = { ...this.productForm.cd };
    } else if (type === 'DVD') {
      payload.dvd = { ...this.productForm.dvd };
    } else if (type === 'NEWSPAPER') {
      payload.newspaper = { ...this.productForm.newspaper };
    }

    if (this.isEditMode && this.editingProductId) {
      this.productService.updateProduct(this.editingProductId, payload).subscribe({
        next: (res) => {
          this.closeProductModal();
          this.fetchProducts();
          this.fetchTotalProductsCount();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Unable to update product';
        }
      });
    } else {
      this.productService.createProduct(payload).subscribe({
        next: (res) => {
          this.closeProductModal();
          this.fetchProducts();
          this.fetchTotalProductsCount();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Unable to create product';
        }
      });
    }
  }

  deleteSelectedProducts() {
    const selectedIds = Object.keys(this.selectedProducts)
      .filter((id) => this.selectedProducts[+id])
      .map((id) => +id);

    if (selectedIds.length === 0) {
      this.showAlert('Selection Required', 'Please select at least one product to delete', 'warning');
      return;
    }

    if (selectedIds.length > 10) {
      this.showAlert('Limit Exceeded', 'You can delete at most 10 products at once', 'warning');
      return;
    }

    this.showConfirm(
      'Confirm Bulk Delete',
      `Are you sure you want to delete ${selectedIds.length} selected product(s)?\n\n(Note: Products with zero stock will be permanently deleted; products with stock > 0 will be deactivated instead.)`,
      'danger',
      () => {
        this.productService.deleteProducts(selectedIds).subscribe({
          next: (res) => {
            const details: string[] = [];
            
            res.results.forEach((item: any) => {
              if (item.status === 'DELETED') {
                details.push(`ID ${item.id} (stock = 0): Permanently deleted.`);
              } else if (item.status === 'DEACTIVATED_ORDERED') {
                details.push(`ID ${item.id} (has orders): Automatically deactivated to preserve transaction history.`);
              } else if (item.status === 'DEACTIVATED') {
                details.push(`ID ${item.id} (stock > 0): Automatically deactivated.`);
              } else {
                details.push(`ID ${item.id}: Product not found.`);
              }
            });

            this.showAlert(
              'Operation Successful',
              `Processed ${selectedIds.length} selected product(s):`,
              'success',
              details
            );
            
            this.fetchProducts();
            this.fetchTotalProductsCount();
          },
          error: (err) => {
            this.showAlert('Execution Error', err.error?.message || 'Unable to delete products', 'error');
          }
        });
      }
    );
  }

  deactivateSelectedProducts() {
    const selectedIds = Object.keys(this.selectedProducts)
      .filter((id) => this.selectedProducts[+id])
      .map((id) => +id);

    if (selectedIds.length === 0) {
      this.showAlert('Selection Required', 'Please select at least one product to deactivate', 'warning');
      return;
    }

    if (selectedIds.length > 10) {
      this.showAlert('Limit Exceeded', 'You can deactivate at most 10 products at once', 'warning');
      return;
    }

    this.showConfirm(
      'Confirm Bulk Deactivation',
      `Are you sure you want to deactivate ${selectedIds.length} selected product(s)?`,
      'warning',
      () => {
        this.productService.deactivateProducts(selectedIds).subscribe({
          next: (res) => {
            const details: string[] = [];
            
            res.results.forEach((item: any) => {
              if (item.status === 'DEACTIVATED') {
                details.push(`ID ${item.id}: Successfully deactivated.`);
              } else {
                details.push(`ID ${item.id}: Product not found.`);
              }
            });

            this.showAlert(
              'Operation Successful',
              `Processed ${selectedIds.length} selected product(s) for deactivation:`,
              'success',
              details
            );
            
            this.fetchProducts();
            this.fetchTotalProductsCount();
          },
          error: (err) => {
            this.showAlert('Execution Error', err.error?.message || 'Unable to deactivate products', 'error');
          }
        });
      }
    );
  }
}
