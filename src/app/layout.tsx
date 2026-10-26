import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Print Mandiri Toko Fotokopi - Scan, Unggah & Cetak Cepat',
  description:
    'Sistem cetak mandiri via QR Code untuk toko fotokopi. Unggah file dokumen tanpa perlu simpan nomor WhatsApp, cepat, rapi, dan terpercaya.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
