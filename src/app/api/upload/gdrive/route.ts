import { NextResponse } from 'next/server';
import {
  initiateGDriveResumableUpload,
  sendGDriveChunk,
  isGDriveConfigured,
} from '@/lib/gdrive';

export async function POST(request: Request) {
  try {
    if (!isGDriveConfigured) {
      return NextResponse.json(
        { error: 'Google Drive belum dikonfigurasi di server' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { filename, fileType, fileSize } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename wajib diisi' },
        { status: 400 }
      );
    }

    const { sessionUri } = await initiateGDriveResumableUpload(filename, fileType, fileSize);

    return NextResponse.json({
      success: true,
      sessionUri,
    });
  } catch (err: unknown) {
    console.error('Error initiating Google Drive upload:', err);
    const message = err instanceof Error ? err.message : 'Gagal memulai unggahan Google Drive';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isGDriveConfigured) {
      return NextResponse.json(
        { error: 'Google Drive belum dikonfigurasi di server' },
        { status: 503 }
      );
    }

    const sessionUri = request.headers.get('x-session-uri');
    const contentRange = request.headers.get('content-range');

    if (!sessionUri || !contentRange) {
      return NextResponse.json(
        { error: 'Header x-session-uri dan content-range wajib disertakan' },
        { status: 400 }
      );
    }

    const arrayBuffer = await request.arrayBuffer();
    const chunkBuffer = Buffer.from(arrayBuffer);

    const result = await sendGDriveChunk(sessionUri, chunkBuffer, contentRange);

    if (result.status === 'complete' && result.fileId) {
      return NextResponse.json({
        success: true,
        status: 'complete',
        fileId: result.fileId,
        storageKey: `gdrive:${result.fileId}`,
        webViewLink: result.webViewLink,
      });
    }

    return NextResponse.json({
      success: true,
      status: 'incomplete',
    });
  } catch (err: unknown) {
    console.error('Error uploading chunk to Google Drive:', err);
    const message = err instanceof Error ? err.message : 'Gagal mengirim chunk ke Google Drive';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
