import { NextResponse } from 'next/server';

export async function PUT(request: Request) {
  // Mock endpoint upload lokal jika kredensial R2 belum diatur
  return NextResponse.json({
    success: true,
    message: 'File berhasil diunggah (Simulasi Lokal)',
  });
}

export async function GET(request: Request) {
  return new NextResponse('Konten file simulasi lokal untuk pengujian.', {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'inline; filename="mock-file.txt"',
    },
  });
}
