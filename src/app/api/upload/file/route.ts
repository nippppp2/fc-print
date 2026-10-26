import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { LOCAL_UPLOAD_DIR } from '@/lib/r2';

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing storage key' }, { status: 400 });
    }

    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Pastikan direktori tujuan tersedia
    const targetPath = path.join(LOCAL_UPLOAD_DIR, key);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(targetPath, buffer);

    return NextResponse.json({
      success: true,
      message: 'File fisik berhasil disimpan di penyimpanan lokal',
      size: buffer.length,
    });
  } catch (err: unknown) {
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

    const targetPath = path.join(LOCAL_UPLOAD_DIR, key);

    if (!fs.existsSync(targetPath)) {
      // Fallback agar browser tidak gagal dengan 404 "File wasn't available on site"
      const noticeText = `Dokumen: ${filename}\nCatatan: Berkas ini tercatat dari sesi uji coba sebelum server penyimpanan lokal aktif.\nSilakan unggah dokumen baru dari halaman utama untuk mengunduh berkas asli.`;
      return new NextResponse(Buffer.from(noticeText), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename.replace(/\.[^.]+$/, ''))}_info.txt"`,
        },
      });
    }

    const fileBuffer = await fs.promises.readFile(targetPath);

    // Deteksi tipe konten MIME
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'doc') contentType = 'application/msword';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengunduh file';
    return new NextResponse(msg, { status: 500 });
  }
}
