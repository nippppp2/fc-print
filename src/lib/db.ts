import { neon } from '@neondatabase/serverless';
import { Order, OrderStatus, StoreSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';

function getSanitizedDbUrl(): string | undefined {
  const candidates = [
    process.env.POSTGRES_URL,
    process.env.NEON_DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.DATABASE_URL,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const trimmed = raw.trim().replace(/^["']|["']$/g, '');
    if (trimmed.startsWith('postgres://') || trimmed.startsWith('postgresql://')) {
      try {
        const u = new URL(trimmed);
        u.searchParams.delete('channel_binding');
        return u.toString();
      } catch {
        // continue
      }
    }
  }
  return undefined;
}

const databaseUrl = getSanitizedDbUrl();
export const isDbConfigured = Boolean(databaseUrl);

// Neon SQL Client
const sql = isDbConfigured ? neon(databaseUrl!) : null;

// Pastikan tabel di Neon PostgreSQL otomatis dibuat saat pertama kali dipanggil
let tablesInitialized = false;
async function ensureTables() {
  if (!sql || tablesInitialized) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        queue_number VARCHAR(16) NOT NULL,
        tracking_code VARCHAR(32) NOT NULL UNIQUE,
        customer_name VARCHAR(100) DEFAULT 'Pelanggan',
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        total_files INTEGER NOT NULL DEFAULT 1,
        files JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        printing_at TIMESTAMPTZ,
        ready_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        files_deleted_at TIMESTAMPTZ
      );
    `;
    // Migrasi kolom jika tabel lama sudah ada
    await sql`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100) DEFAULT 'Pelanggan';
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS file_blobs (
        storage_key VARCHAR(128) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        base64_data TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    tablesInitialized = true;
  } catch (err) {
    console.error('Gagal inisialisasi tabel Neon DB:', err);
  }
}

// ========================================================
// Database Store (Serverless Neon + In-Memory Fallback)
// ========================================================
export const db = {
  async generateQueueNumber(): Promise<string> {
    if (sql) {
      await ensureTables();
      // Hitung urutan antrean hari ini
      const rows = await sql`
        SELECT queue_number FROM orders 
        WHERE created_at >= CURRENT_DATE 
        ORDER BY created_at DESC LIMIT 1;
      `;
      if (rows.length > 0 && rows[0].queue_number) {
        const lastNum = parseInt(rows[0].queue_number.replace('A-', '')) || 0;
        return `A-${String(lastNum + 1).padStart(3, '0')}`;
      }
      return 'A-001';
    }
    return memoryStore.generateQueueNumber();
  },

  async saveOrder(order: Order): Promise<Order> {
    if (sql) {
      await ensureTables();
      await sql`
        INSERT INTO orders (id, queue_number, tracking_code, customer_name, status, total_files, files, created_at)
        VALUES (${order.id}, ${order.queueNumber}, ${order.trackingCode}, ${order.customerName || 'Pelanggan'}, ${order.status}, ${order.totalFiles}, ${JSON.stringify(order.files)}, ${order.createdAt});
      `;
      return order;
    }
    return memoryStore.saveOrder(order);
  },

  async getOrderByTrackingCode(trackingCode: string): Promise<Order | undefined> {
    if (sql) {
      await ensureTables();
      const rows = await sql`
        SELECT * FROM orders WHERE tracking_code = ${trackingCode} LIMIT 1;
      `;
      if (rows.length === 0) return undefined;
      const r = rows[0];
      return {
        id: r.id,
        queueNumber: r.queue_number,
        trackingCode: r.tracking_code,
        customerName: r.customer_name || 'Pelanggan',
        status: r.status as OrderStatus,
        totalFiles: r.total_files,
        files: typeof r.files === 'string' ? JSON.parse(r.files) : r.files,
        createdAt: r.created_at,
        printingAt: r.printing_at,
        readyAt: r.ready_at,
        completedAt: r.completed_at,
        filesDeletedAt: r.files_deleted_at,
      };
    }
    return memoryStore.getOrderByTrackingCode(trackingCode);
  },

  async getOrderById(id: string): Promise<Order | undefined> {
    if (sql) {
      await ensureTables();
      const rows = await sql`
        SELECT * FROM orders WHERE id = ${id} LIMIT 1;
      `;
      if (rows.length === 0) return undefined;
      const r = rows[0];
      return {
        id: r.id,
        queueNumber: r.queue_number,
        trackingCode: r.tracking_code,
        customerName: r.customer_name || 'Pelanggan',
        status: r.status as OrderStatus,
        totalFiles: r.total_files,
        files: typeof r.files === 'string' ? JSON.parse(r.files) : r.files,
        createdAt: r.created_at,
        printingAt: r.printing_at,
        readyAt: r.ready_at,
        completedAt: r.completed_at,
        filesDeletedAt: r.files_deleted_at,
      };
    }
    return memoryStore.getOrderById(id);
  },

  async getAllOrders(): Promise<Order[]> {
    if (sql) {
      await ensureTables();
      const rows = await sql`
        SELECT * FROM orders ORDER BY created_at DESC;
      `;
      return rows.map((r) => ({
        id: r.id,
        queueNumber: r.queue_number,
        trackingCode: r.tracking_code,
        customerName: r.customer_name || 'Pelanggan',
        status: r.status as OrderStatus,
        totalFiles: r.total_files,
        files: typeof r.files === 'string' ? JSON.parse(r.files) : r.files,
        createdAt: r.created_at,
        printingAt: r.printing_at,
        readyAt: r.ready_at,
        completedAt: r.completed_at,
        filesDeletedAt: r.files_deleted_at,
      }));
    }
    return memoryStore.getAllOrders();
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order | undefined> {
    if (sql) {
      await ensureTables();
      const now = new Date().toISOString();
      let extraField = '';
      if (status === 'PRINTING') {
        await sql`UPDATE orders SET status = ${status}, printing_at = COALESCE(printing_at, NOW()) WHERE id = ${id}`;
      } else if (status === 'READY') {
        await sql`UPDATE orders SET status = ${status}, ready_at = COALESCE(ready_at, NOW()) WHERE id = ${id}`;
      } else if (status === 'COMPLETED') {
        await sql`UPDATE orders SET status = ${status}, completed_at = COALESCE(completed_at, NOW()) WHERE id = ${id}`;
      } else {
        await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
      }

      const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1;`;
      if (rows.length === 0) return undefined;
      const r = rows[0];
      return {
        id: r.id,
        queueNumber: r.queue_number,
        trackingCode: r.tracking_code,
        customerName: r.customer_name || 'Pelanggan',
        status: r.status as OrderStatus,
        totalFiles: r.total_files,
        files: typeof r.files === 'string' ? JSON.parse(r.files) : r.files,
        createdAt: r.created_at,
        printingAt: r.printing_at,
        readyAt: r.ready_at,
        completedAt: r.completed_at,
        filesDeletedAt: r.files_deleted_at,
      };
    }
    return memoryStore.updateOrderStatus(id, status);
  },

  async getSettings(): Promise<StoreSettings> {
    if (sql) {
      await ensureTables();
      const rows = await sql`SELECT data FROM settings WHERE id = 1 LIMIT 1;`;
      if (rows.length > 0) {
        return typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
      }
      return DEFAULT_SETTINGS;
    }
    return memoryStore.getSettings();
  },

  async updateSettings(newSettings: Partial<StoreSettings>): Promise<StoreSettings> {
    if (sql) {
      await ensureTables();
      const current = await this.getSettings();
      const updated = { ...current, ...newSettings };
      await sql`
        INSERT INTO settings (id, data) 
        VALUES (1, ${JSON.stringify(updated)})
        ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(updated)};
      `;
      return updated;
    }
    return memoryStore.updateSettings(newSettings);
  },

  async saveFileBlob(storageKey: string, filename: string, contentType: string, buffer: Buffer): Promise<void> {
    if (sql) {
      await ensureTables();
      const base64Data = buffer.toString('base64');
      await sql`
        INSERT INTO file_blobs (storage_key, filename, content_type, base64_data)
        VALUES (${storageKey}, ${filename}, ${contentType}, ${base64Data})
        ON CONFLICT (storage_key) DO UPDATE SET base64_data = ${base64Data}, content_type = ${contentType};
      `;
      return;
    }
    return memoryStore.saveFileBlob(storageKey, filename, contentType, buffer);
  },

  async getFileBlob(storageKey: string): Promise<{ filename: string; contentType: string; buffer: Buffer } | null> {
    if (sql) {
      await ensureTables();
      const rows = await sql`
        SELECT storage_key, filename, content_type, base64_data 
        FROM file_blobs 
        WHERE storage_key = ${storageKey} 
        LIMIT 1;
      `;
      if (rows.length === 0) return null;
      return {
        filename: rows[0].filename,
        contentType: rows[0].content_type,
        buffer: Buffer.from(rows[0].base64_data, 'base64'),
      };
    }
    return memoryStore.getFileBlob(storageKey);
  },

  async deleteFileBlobs(storageKeys: string[]): Promise<void> {
    if (storageKeys.length === 0) return;
    if (sql) {
      await ensureTables();
      for (const key of storageKeys) {
        await sql`DELETE FROM file_blobs WHERE storage_key = ${key};`;
      }
      return;
    }
    return memoryStore.deleteFileBlobs(storageKeys);
  },
};

// ==========================================
// In-Memory Fallback Store untuk Local Dev
// ==========================================
class MemoryStore {
  private orders: Map<string, Order> = new Map();
  private settings: StoreSettings = { ...DEFAULT_SETTINGS };
  private queueCounter = 1;
  private lastQueueDate = new Date().toDateString();

  constructor() {
    this.resetDailyQueueIfNeeded();
  }

  private resetDailyQueueIfNeeded() {
    const today = new Date().toDateString();
    if (this.lastQueueDate !== today) {
      this.queueCounter = 1;
      this.lastQueueDate = today;
    }
  }

  generateQueueNumber(): string {
    this.resetDailyQueueIfNeeded();
    const formatted = String(this.queueCounter).padStart(3, '0');
    this.queueCounter++;
    return `A-${formatted}`;
  }

  saveOrder(order: Order): Order {
    this.orders.set(order.id, order);
    return order;
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  getOrderByTrackingCode(trackingCode: string): Order | undefined {
    for (const order of this.orders.values()) {
      if (order.trackingCode === trackingCode) {
        return order;
      }
    }
    return undefined;
  }

  getAllOrders(): Order[] {
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  updateOrderStatus(id: string, status: OrderStatus): Order | undefined {
    const order = this.orders.get(id);
    if (!order) return undefined;

    order.status = status;
    const now = new Date().toISOString();
    if (status === 'PRINTING' && !order.printingAt) order.printingAt = now;
    if (status === 'READY' && !order.readyAt) order.readyAt = now;
    if (status === 'COMPLETED' && !order.completedAt) order.completedAt = now;

    this.orders.set(id, order);
    return order;
  }

  getSettings(): StoreSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<StoreSettings>): StoreSettings {
    this.settings = { ...this.settings, ...newSettings };
    return { ...this.settings };
  }

  private files: Map<string, { filename: string; contentType: string; buffer: Buffer }> = new Map();

  saveFileBlob(storageKey: string, filename: string, contentType: string, buffer: Buffer): void {
    this.files.set(storageKey, { filename, contentType, buffer });
  }

  getFileBlob(storageKey: string): { filename: string; contentType: string; buffer: Buffer } | null {
    return this.files.get(storageKey) || null;
  }

  deleteFileBlobs(storageKeys: string[]): void {
    for (const key of storageKeys) {
      this.files.delete(key);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __memoryStore: MemoryStore | undefined;
}

export const memoryStore = global.__memoryStore || new MemoryStore();
if (process.env.NODE_ENV !== 'production') {
  global.__memoryStore = memoryStore;
}
