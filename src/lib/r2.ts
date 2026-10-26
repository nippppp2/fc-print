import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'fotokopi-orders';

export const isR2Configured = Boolean(accountId && accessKeyId && secretAccessKey);

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export const s3Client = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    })
  : null;

/**
 * Menghasilkan Presigned PUT URL untuk upload (R2 atau Local Storage)
 */
export async function getPresignedUploadUrl(
  storageKey: string,
  contentType: string,
  originalFilename?: string,
  expiresIn = 900
) {
  if (!s3Client || !isR2Configured) {
    const fnParam = originalFilename ? `&filename=${encodeURIComponent(originalFilename)}` : '';
    return {
      uploadUrl: `/api/upload/file?key=${encodeURIComponent(storageKey)}${fnParam}`,
      storageKey,
      isMock: true,
    };
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return {
    uploadUrl,
    storageKey,
    isMock: false,
  };
}

/**
 * Menghasilkan Presigned GET URL untuk admin mengunduh dokumen asli
 */
export async function getPresignedDownloadUrl(
  storageKey: string,
  originalFilename?: string,
  expiresIn = 1800
) {
  if (!s3Client || !isR2Configured) {
    const fnParam = originalFilename ? `&filename=${encodeURIComponent(originalFilename)}` : '';
    return `/api/upload/file?key=${encodeURIComponent(storageKey)}${fnParam}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    ResponseContentDisposition: originalFilename
      ? `attachment; filename="${encodeURIComponent(originalFilename)}"`
      : undefined,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Menghapus kumpulan objek file (Cloudflare R2 atau Local Storage)
 */
export async function deleteR2Files(storageKeys: string[]) {
  if (storageKeys.length === 0) return;

  if (s3Client && isR2Configured) {
    const command = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: storageKeys.map((key) => ({ Key: key })),
      },
    });
    await s3Client.send(command);
  } else {
    // Hapus dari folder lokal
    for (const key of storageKeys) {
      const localPath = path.join(LOCAL_UPLOAD_DIR, key);
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch {
          // ignore
        }
      }
    }
  }
}
