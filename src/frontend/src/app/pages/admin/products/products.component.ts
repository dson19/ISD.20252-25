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
  stockDelta = 0;
  stockReason = '';

  // Form State
  isEditMode = false;
  editingProductId: number | null = null;
  errorMessage = '';

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
      language: 'Tiếng Việt',
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
      language: 'Tiếng Việt',
      subtitles: 'Tiếng Việt'
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

  ngOnInit() {
    this.fetchProducts();
  }

  fetchProducts() {
    this.isLoading = true;
    console.log('[ProductsComponent] fetchProducts() bat dau goi API...');
    
    const params: ProductSearchParams = {
      keyword: this.keyword,
      category: this.category,
      mediaTypes: this.mediaTypesFilter ? [this.mediaTypesFilter] : undefined
    };
    
    console.log('[ProductsComponent] fetchProducts() gui params:', params);
    console.log('[ProductsComponent] Token trong localStorage:', localStorage.getItem('aims_token'));

    this.productService.searchProducts(params).subscribe({
      next: (data) => {
        console.log('[ProductsComponent] fetchProducts() nhan du lieu thanh cong:', data);
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
        console.error('[ProductsComponent] fetchProducts() gap loi khi goi API:', err);
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
    this.stockDelta = 0;
    this.stockReason = '';
    this.isStockModalOpen = true;
  }

  closeStockModal() {
    this.isStockModalOpen = false;
    this.selectedProductForStock = null;
  }

  saveStockAdjustment() {
    if (!this.selectedProductForStock) return;
    
    if (this.stockDelta === 0) {
      alert('Vui lòng nhập số lượng điều chỉnh khác 0');
      return;
    }

    const finalStock = this.selectedProductForStock.quantityInStock + this.stockDelta;
    if (finalStock < 0) {
      alert(`Điều chỉnh kho không thể làm tồn kho bị âm (Tồn kho hiện tại: ${this.selectedProductForStock.quantityInStock})`);
      return;
    }

    if (!this.stockReason.trim()) {
      alert('Vui lòng ghi rõ lý do điều chỉnh kho');
      return;
    }

    this.productService
      .adjustStock(this.selectedProductForStock.productID, this.stockDelta, this.stockReason)
      .subscribe({
        next: (updatedProduct) => {
          this.closeStockModal();
          this.fetchProducts();
        },
        error: (err) => {
          alert(err.error?.message || 'Không thể điều chỉnh tồn kho');
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
        coverType: 'Bìa mềm',
        publisher: '',
        publicationDate: '',
        numPages: null,
        language: 'Tiếng Việt',
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
        language: 'Tiếng Việt',
        subtitles: 'Tiếng Việt'
      },
      newspaper: {
        editorInChief: '',
        publisher: '',
        publicationDate: ''
      }
    };
    
    this.isProductModalOpen = true;
  }

  openEditModal(product: Product) {
    this.isEditMode = true;
    this.editingProductId = product.productID;
    this.errorMessage = '';

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
          originalPrice: fullProduct.originalPrice,
          currentPrice: fullProduct.currentPrice,
          quantityInStock: fullProduct.quantityInStock,
          imageUrl: fullProduct.imageUrl || '',
          status: fullProduct.status,
          book: fullProduct.book || {
            authors: '',
            coverType: 'Bìa mềm',
            publisher: '',
            publicationDate: '',
            numPages: null,
            language: 'Tiếng Việt',
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
            language: 'Tiếng Việt',
            subtitles: 'Tiếng Việt'
          },
          newspaper: fullProduct.newspaper || {
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
      },
      error: (err) => {
        alert(err.error?.message || 'Không thể tải chi tiết sản phẩm');
      }
    });
  }

  closeProductModal() {
    this.isProductModalOpen = false;
    this.errorMessage = '';
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
      this.errorMessage = 'Tiêu đề không được để trống';
      return false;
    }
    if (!this.productForm.category?.trim()) {
      this.errorMessage = 'Danh mục chung không được để trống';
      return false;
    }
    if (!this.productForm.barcode?.trim()) {
      this.errorMessage = 'Mã vạch (Barcode) không được để trống';
      return false;
    }
    if (this.productForm.weight <= 0) {
      this.errorMessage = 'Khối lượng phải lớn hơn 0';
      return false;
    }
    if (this.productForm.length !== null && this.productForm.length <= 0) {
      this.errorMessage = 'Chiều dài phải lớn hơn 0';
      return false;
    }
    if (this.productForm.width !== null && this.productForm.width <= 0) {
      this.errorMessage = 'Chiều rộng phải lớn hơn 0';
      return false;
    }
    if (this.productForm.height !== null && this.productForm.height <= 0) {
      this.errorMessage = 'Chiều cao phải lớn hơn 0';
      return false;
    }
    if (this.productForm.quantityInStock < 0 || !Number.isInteger(this.productForm.quantityInStock)) {
      this.errorMessage = 'Tồn kho phải là số nguyên không âm';
      return false;
    }

    // Price Ratio validation
    const origPrice = Number(this.productForm.originalPrice);
    const currPrice = Number(this.productForm.currentPrice);
    if (origPrice <= 0) {
      this.errorMessage = 'Giá gốc phải lớn hơn 0';
      return false;
    }
    if (currPrice < origPrice * 0.3 || currPrice > origPrice * 1.5) {
      this.errorMessage = 'Giá bán phải nằm trong khoảng từ 30% đến 150% của giá gốc';
      return false;
    }

    // MediaType specific validation
    const type = this.productForm.mediaType;
    if (type === 'BOOK') {
      const book = this.productForm.book;
      if (!book.authors?.trim()) {
        this.errorMessage = 'Tác giả sách không được để trống';
        return false;
      }
      if (!book.coverType?.trim()) {
        this.errorMessage = 'Loại bìa sách không được để trống';
        return false;
      }
      if (!book.publisher?.trim()) {
        this.errorMessage = 'Nhà xuất bản không được để trống';
        return false;
      }
      if (!book.publicationDate?.trim()) {
        this.errorMessage = 'Ngày xuất bản không được để trống';
        return false;
      }
      if (book.numPages !== null && book.numPages <= 0) {
        this.errorMessage = 'Số trang phải lớn hơn 0';
        return false;
      }
    } else if (type === 'CD') {
      const cd = this.productForm.cd;
      if (!cd.artists?.trim()) {
        this.errorMessage = 'Nghệ sĩ CD không được để trống';
        return false;
      }
      if (!cd.recordLabel?.trim()) {
        this.errorMessage = 'Hãng đĩa CD không được để trống';
        return false;
      }
      if (!cd.genre?.trim()) {
        this.errorMessage = 'Thể loại CD không được để trống';
        return false;
      }
      if (!cd.tracks || cd.tracks.length === 0) {
        this.errorMessage = 'CD phải có ít nhất một bài hát';
        return false;
      }
      for (let i = 0; i < cd.tracks.length; i++) {
        if (!cd.tracks[i].title?.trim()) {
          this.errorMessage = `Bài hát số ${i + 1} không được để trống tiêu đề`;
          return false;
        }
        if (cd.tracks[i].lengthSeconds <= 0) {
          this.errorMessage = `Thời lượng bài hát số ${i + 1} phải lớn hơn 0 giây`;
          return false;
        }
      }
    } else if (type === 'DVD') {
      const dvd = this.productForm.dvd;
      if (!dvd.discType?.trim()) {
        this.errorMessage = 'Loại đĩa DVD không được để trống';
        return false;
      }
      if (!dvd.director?.trim()) {
        this.errorMessage = 'Đạo diễn DVD không được để trống';
        return false;
      }
      if (dvd.runtimeMinutes <= 0) {
        this.errorMessage = 'Thời lượng DVD phải lớn hơn 0 phút';
        return false;
      }
      if (!dvd.studio?.trim()) {
        this.errorMessage = 'Studio sản xuất DVD không được để trống';
        return false;
      }
      if (!dvd.language?.trim()) {
        this.errorMessage = 'Ngôn ngữ DVD không được để trống';
        return false;
      }
    } else if (type === 'NEWSPAPER') {
      const np = this.productForm.newspaper;
      if (!np.editorInChief?.trim()) {
        this.errorMessage = 'Tổng biên tập báo không được để trống';
        return false;
      }
      if (!np.publisher?.trim()) {
        this.errorMessage = 'Nhà xuất bản báo không được để trống';
        return false;
      }
      if (!np.publicationDate?.trim()) {
        this.errorMessage = 'Ngày xuất bản báo không được để trống';
        return false;
      }
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
      originalPrice: Number(this.productForm.originalPrice),
      currentPrice: Number(this.productForm.currentPrice),
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
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Không thể cập nhật sản phẩm';
        }
      });
    } else {
      this.productService.createProduct(payload).subscribe({
        next: (res) => {
          this.closeProductModal();
          this.fetchProducts();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Không thể tạo sản phẩm';
        }
      });
    }
  }

  // Batch delete items via checkboxes
  deleteSelectedProducts() {
    const selectedIds = Object.keys(this.selectedProducts)
      .filter((id) => this.selectedProducts[+id])
      .map((id) => +id);

    if (selectedIds.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm để xóa');
      return;
    }

    if (selectedIds.length > 10) {
      alert('Hệ thống giới hạn xóa tối đa 10 sản phẩm trong một lần xóa hàng loạt');
      return;
    }

    const confirmDel = confirm(`Bạn có chắc chắn muốn xóa/ngừng hoạt động ${selectedIds.length} sản phẩm đã chọn hay không?`);
    if (!confirmDel) return;

    this.productService.deleteProducts(selectedIds).subscribe({
      next: (res) => {
        let deletedMsg = '';
        let deactMsg = '';
        let failMsg = '';
        
        // Output detailed statuses
        res.results.forEach((item: any) => {
          if (item.status === 'DELETED') {
            deletedMsg += `ID ${item.id} (hết hàng): Đã xóa cứng khỏi database.\n`;
          } else if (item.status === 'DEACTIVATED') {
            deactMsg += `ID ${item.id} (còn hàng): Đã chuyển thành NGỪNG HOẠT ĐỘNG và ghi log.\n`;
          } else {
            failMsg += `ID ${item.id}: Không tìm thấy.\n`;
          }
        });

        alert(`Kết quả thực thi xóa hàng loạt:\n\n${deletedMsg}${deactMsg}${failMsg}`);
        
        this.fetchProducts();
      },
      error: (err) => {
        alert(err.error?.message || 'Không thể xóa hàng loạt sản phẩm');
      }
    });
  }
}
