import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../services/product.service';
import { FormsModule } from '@angular/forms';

interface ProductLog {
  logID: number;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'DEACTIVATE' | 'STOCK_ADJUST' | string;
  changedFields: any;
  performedBy: string;
  reason?: string | null;
  createdAt: string;
  product?: {
    productID: number;
    title: string;
    barcode: string;
    productType: string;
  } | null;
}

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs.component.html'
})
export class LogsComponent implements OnInit {
  logs: ProductLog[] = [];
  filteredLogs: ProductLog[] = [];
  isLoading = false;

  // Search & Filters
  searchQuery = '';
  actionFilter = '';
  timeFilter = 'ALL'; // ALL, 24H, 7D

  // JSON Diff Modal
  isDiffModalOpen = false;
  selectedLogForDiff: ProductLog | null = null;
  parsedBeforeFields: any = null;
  parsedAfterFields: any = null;

  constructor(
    private readonly productService: ProductService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.fetchLogs();
  }

  fetchLogs() {
    this.isLoading = true;
    this.productService.getAuditLogs().subscribe({
      next: (data) => {
        this.logs = data;
        this.applyFilter();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching audit logs:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter() {
    const now = new Date().getTime();
    this.filteredLogs = this.logs.filter((log) => {
      const barcode = log.product?.barcode || '';
      const title = log.product?.title || '';
      const actor = log.performedBy || '';
      const action = log.actionType || '';

      const matchesSearch =
        barcode.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        actor.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        action.toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesAction = !this.actionFilter || log.actionType === this.actionFilter;

      // Time filtering logic
      let matchesTime = true;
      const logTime = new Date(log.createdAt).getTime();
      if (this.timeFilter === '24H') {
        matchesTime = now - logTime <= 24 * 60 * 60 * 1000;
      } else if (this.timeFilter === '7D') {
        matchesTime = now - logTime <= 7 * 24 * 60 * 60 * 1000;
      }

      return matchesSearch && matchesAction && matchesTime;
    });
  }

  openDiffModal(log: ProductLog) {
    this.selectedLogForDiff = log;
    this.parsedBeforeFields = null;
    this.parsedAfterFields = null;

    try {
      const changes = typeof log.changedFields === 'string' ? JSON.parse(log.changedFields) : log.changedFields;
      if (changes) {
        if (changes.before) {
          this.parsedBeforeFields = changes.before;
        }
        if (changes.after) {
          this.parsedAfterFields = changes.after;
        } else if (!changes.before) {
          // If no explicit before/after block, the changes root represents the final values
          this.parsedAfterFields = changes;
        }
      }
    } catch (e) {
      console.error('Error parsing changed fields:', e);
    }

    this.isDiffModalOpen = true;
  }

  closeDiffModal() {
    this.isDiffModalOpen = false;
    this.selectedLogForDiff = null;
    this.parsedBeforeFields = null;
    this.parsedAfterFields = null;
  }

  // Helper method to extract objects as arrays for easy HTML looping
  getObjectKeysAndValues(obj: any): { key: string; value: any }[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj)
      .filter(key => key !== 'product' && key !== 'book' && key !== 'cd' && key !== 'dvd' && key !== 'newspaper') // Strip duplicates
      .map(key => ({
        key,
        value: typeof obj[key] === 'object' ? JSON.stringify(obj[key]) : obj[key]
      }));
  }

  // Dashboard statistics getters
  get totalLogsCount(): number {
    return this.filteredLogs.length;
  }

  get createLogsCount(): number {
    return this.filteredLogs.filter(l => l.actionType === 'CREATE').length;
  }

  get stockLogsCount(): number {
    return this.filteredLogs.filter(l => l.actionType === 'STOCK_ADJUST').length;
  }

  get deleteLogsCount(): number {
    return this.filteredLogs.filter(l => l.actionType === 'DELETE' || l.actionType === 'DEACTIVATE').length;
  }
}
