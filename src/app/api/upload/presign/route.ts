import { NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@/lib/r2';
import { nanoid } from 'nanoid';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, fileType } = body;

    if (!filename || !fileType) {
      return NextResponse.json(
        { error: 'Filename dan fileType wajib diisi' },
        { status: 400 }
      );
    }

    // Buat safe storage key terisolasi: orders/{date}/{nanoid}-{filename}
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const datePrefix = new Date().toISOString().slice(0, 10);
    const storageKey = `orders/${datePrefix}/${nanoid(8)}_${safeFilename}`;

    const presignedData = await getPresignedUploadUrl(storageKey, fileType, filename);

    return NextResponse.json({
      success: true,
      uploadUrl: presignedData.uploadUrl,
      storageKey: presignedData.storageKey,
      isMock: presignedData.isMock,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal membuat URL unggah';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
