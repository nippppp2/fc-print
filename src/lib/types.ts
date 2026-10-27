export type OrderStatus = 'PENDING' | 'PRINTING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface OrderFileConfig {
  id?: string;
  originalFilename: string;
  storageKey: string;
  fileType: string;
  fileSizeBytes: number;
  downloadUrl?: string;
}

export interface Order {
  id: string;
  queueNumber: string; // e.g., 'A-001'
  trackingCode: string; // Unguessable tracking id
  status: OrderStatus;
  totalFiles: number;
  files: OrderFileConfig[];
  createdAt: string;
  printingAt?: string;
  readyAt?: string;
  completedAt?: string;
  filesDeletedAt?: string;
}

export type AdminRole = 'SUPER_ADMIN' | 'KASIR';

export interface StoreSettings {
  storeName: string;
  isOpen: boolean;
  maxFileSizeMb: number;
  maxFilesPerOrder: number;
  kasirPin?: string;       // Default: '1234'
  superAdminPin?: string;  // Default: '9999'
  adminPin?: string;       // Backward compatibility fallback
}
