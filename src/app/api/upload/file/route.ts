import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const filename = searchParams.get('filename') || 'dokumen';

    if (!key) {
      return NextResponse.json({ error: 'Missing storage key' }, { status: 400 });
    }

    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Simpan file blob ke database (Neon PostgreSQL) atau memory fallback
    await db.saveFileBlob(key, filename, contentType, buffer);

    return NextResponse.json({
      success: true,
      message: 'File berhasil disimpan',
      size: buffer.length,
    });
  } catch (err: unknown) {
    console.error('Gagal menyimpan file blob:', err);
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan file';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const filename = searchParams.get('filename') || 'dokumen';

    if (!key) {
      return new NextResponse('Storage key tidak ditemukan', { status: 400 });
    }

    const fileBlob = await db.getFileBlob(key);

    if (!fileBlob) {
      // Fallback pesan jika file tidak ada di database
      const noticeText = `Dokumen: ${filename}\nCatatan: Berkas tidak ditemukan di penyimpanan server.\nSilakan unggah dokumen kembali dari halaman utama.`;
      return new NextResponse(Buffer.from(noticeText), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename.replace(/\.[^.]+$/, ''))}_info.txt"`,
        },
      });
    }

    // Deteksi tipe konten jika belum tersimpan secara eksplisit
    let finalContentType = fileBlob.contentType;
    if (!finalContentType || finalContentType === 'application/octet-stream') {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') finalContentType = 'application/pdf';
      else if (ext === 'jpg' || ext === 'jpeg') finalContentType = 'image/jpeg';
      else if (ext === 'png') finalContentType = 'image/png';
      else if (ext === 'docx') finalContentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === 'doc') finalContentType = 'application/msword';
    }

    return new NextResponse(new Uint8Array(fileBlob.buffer), {
      headers: {
        'Content-Type': finalContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileBlob.filename || filename)}"`,
        'Content-Length': fileBlob.buffer.length.toString(),
      },
    });
  } catch (err: unknown) {
    console.error('Gagal mengunduh file:', err);
    const msg = err instanceof Error ? err.message : 'Gagal mengunduh file';
    return new NextResponse(msg, { status: 500 });
  }
}
