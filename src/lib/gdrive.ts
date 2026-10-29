import { google } from 'googleapis';
import { Readable } from 'stream';

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Handle both literal newlines and escaped '\n' in environment variables
const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Dukungan OAuth 2.0 (agar menggunakan kuota 15 GB asli akun Gmail pengguna)
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

const isOAuthReady = Boolean(clientId && clientSecret && refreshToken && folderId);
const isServiceAccountReady = Boolean(clientEmail && privateKey && folderId);

export const isGDriveConfigured = Boolean(isOAuthReady || isServiceAccountReady);

export function getGoogleAuth() {
  if (!isGDriveConfigured) return null;

  // Prioritaskan OAuth 2.0 jika tersedia (menggunakan kuota 15 GB akun pengguna)
  if (isOAuthReady) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  // Fallback ke Service Account (jika akun Google Workspace / Shared Drive)
  if (clientEmail && privateKey) {
    return new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  return null;
}

export function getDriveClient() {
  const auth = getGoogleAuth();
  if (!auth) return null;
  return google.drive({ version: 'v3', auth });
}

async function getGoogleAccessToken(): Promise<string> {
  const auth = getGoogleAuth();
  if (!auth) {
    throw new Error('Google Drive belum dikonfigurasi (cek GOOGLE_CLIENT_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL)');
  }
  const tokenRes = await auth.getAccessToken();
  const token = typeof tokenRes === 'string' ? tokenRes : tokenRes?.token;
  if (!token) {
    throw new Error('Gagal mendapatkan access token Google Drive');
  }
  return token;
}

/**
 * Memulai sesi Resumable Upload langsung ke Google Drive
 */
export async function initiateGDriveResumableUpload(
  filename: string,
  fileType: string,
  fileSize?: number
): Promise<{ sessionUri: string }> {
  const accessToken = await getGoogleAccessToken();

  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const datePrefix = new Date().toISOString().slice(0, 10);
  const driveFilename = `${datePrefix}_${safeFilename}`;

  const metadata = {
    name: driveFilename,
    parents: folderId ? [folderId] : undefined,
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': fileType || 'application/octet-stream',
  };

  if (fileSize && fileSize > 0) {
    headers['X-Upload-Content-Length'] = fileSize.toString();
  }

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers,
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errorText}`);
  }

  const sessionUri = res.headers.get('location');
  if (!sessionUri) {
    throw new Error('Google Drive tidak mengembalikan session URL (Location header)');
  }

  return { sessionUri };
}

/**
 * Mengirim potongan chunk (misal 3 MB) ke Resumable Session Google Drive
 */
export async function sendGDriveChunk(
  sessionUri: string,
  chunkBuffer: Buffer,
  contentRange: string
): Promise<{ status: 'incomplete' | 'complete'; fileId?: string; webViewLink?: string }> {
  const accessToken = await getGoogleAccessToken();

  const res = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Length': chunkBuffer.length.toString(),
      'Content-Range': contentRange,
    },
    body: new Uint8Array(chunkBuffer),
  });

  if (res.status === 308) {
    // 308 Resume Incomplete - chunk diterima, menunggu chunk berikutnya
    return { status: 'incomplete' };
  }

  if (res.status === 200 || res.status === 201) {
    const data = await res.json();
    return {
      status: 'complete',
      fileId: data.id,
      webViewLink: data.webViewLink,
    };
  }

  const errorText = await res.text();
  throw new Error(`Gagal mengirim chunk ke Google Drive (${res.status}): ${errorText}`);
}

/**
 * Mendapatkan file stream dari Google Drive untuk diunduh kasir/admin
 */
export async function getGDriveFileStream(fileId: string): Promise<{
  stream: Readable;
  contentType: string;
  name: string;
}> {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive belum dikonfigurasi');
  }

  // Ambil metadata file
  const metaRes = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink, webContentLink',
  });

  const name = metaRes.data.name || 'document';
  const contentType = metaRes.data.mimeType || 'application/octet-stream';

  // Ambil isi binary file sebagai stream
  const fileRes = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return {
    stream: fileRes.data as Readable,
    contentType,
    name,
  };
}

/**
 * Mendapatkan direct link Google Drive untuk dilihat / diunduh
 */
export async function getGDriveDownloadUrl(fileId: string, filename?: string): Promise<string> {
  // Direct link ke Google Drive viewer atau direct download
  // Jika file disetel publik/anyone with link, bisa langsung dibuka di Drive
  const drive = getDriveClient();
  if (drive) {
    try {
      const meta = await drive.files.get({
        fileId,
        fields: 'id, name, webViewLink, webContentLink',
      });
      if (meta.data.webViewLink) {
        return meta.data.webViewLink;
      }
    } catch {
      // ignore
    }
  }

  const fnParam = filename ? `&filename=${encodeURIComponent(filename)}` : '';
  return `/api/upload/file?key=${encodeURIComponent(`gdrive:${fileId}`)}${fnParam}`;
}

/**
 * Menghapus file dari Google Drive
 */
export async function deleteGDriveFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  if (!drive) return;

  try {
    await drive.files.delete({ fileId });
  } catch (err: unknown) {
    console.warn(`Gagal menghapus file Google Drive ${fileId}:`, err);
  }
}
