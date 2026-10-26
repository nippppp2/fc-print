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

export interface StoreSettings {
  storeName: string;
  isOpen: boolean;
  maxFileSizeMb: number;
  maxFilesPerOrder: number;
  adminPin?: string;
}
