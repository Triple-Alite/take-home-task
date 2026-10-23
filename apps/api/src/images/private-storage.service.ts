import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

@Injectable()
export class PrivateStorageService implements OnModuleInit {
  private readonly provider = process.env.STORAGE_PROVIDER ?? (process.env.GCS_BUCKET ? 'gcs' : 'local');
  private readonly bucketName = process.env.GCS_BUCKET;
  private readonly storage = this.bucketName ? new Storage() : undefined;
  private readonly supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  private readonly supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  private readonly supabaseBucketName = process.env.SUPABASE_STORAGE_BUCKET;

  onModuleInit(): void {
    if (this.provider === 'gcs' && (!this.bucketName || !this.storage)) {
      throw new Error('GCS_BUCKET must be configured when STORAGE_PROVIDER=gcs');
    }
    if (this.provider === 'supabase' && (!this.supabaseUrl || !this.supabaseKey || !this.supabaseBucketName)) {
      throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET must be configured when STORAGE_PROVIDER=supabase');
    }
    if (this.provider !== 'gcs' && this.provider !== 'supabase' && this.provider !== 'local') {
      throw new Error('STORAGE_PROVIDER must be local, gcs, or supabase');
    }
    if (process.env.NODE_ENV === 'production' && this.provider === 'local') {
      throw new Error('Local image storage is disabled in production; configure GCS or Supabase Storage');
    }
  }

  async store(bytes: Buffer, mimeType: string): Promise<string> {
    const extension = EXTENSIONS[mimeType];
    if (!extension) throw new InternalServerErrorException('Unsupported storage media type');
    const objectKey = `${randomUUID()}.${extension}`;
    if (this.provider === 'gcs' && this.bucketName && this.storage) {
      await this.storage.bucket(this.bucketName).file(objectKey).save(bytes, {
        resumable: false,
        validation: 'crc32c',
        metadata: { contentType: mimeType, cacheControl: 'private, no-store' }
      });
      return objectKey;
    }
    if (this.provider === 'supabase') {
      const response = await this.supabaseRequest(
        `/object/${encodeURIComponent(this.supabaseBucket())}/${encodeURIComponent(objectKey)}`,
        { method: 'POST', headers: { 'Content-Type': mimeType, 'x-upsert': 'false' }, body: bytes }
      );
      if (!response.ok) throw new InternalServerErrorException(`Supabase Storage upload failed (${response.status})`);
      return objectKey;
    }
    const destination = this.localPath(objectKey);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
    return objectKey;
  }

  async readUrl(objectKey: string): Promise<string | undefined> {
    this.assertKey(objectKey);
    if (this.provider === 'gcs' && this.bucketName && this.storage) {
      const [url] = await this.storage.bucket(this.bucketName).file(objectKey).getSignedUrl({
        version: 'v4', action: 'read', expires: Date.now() + 120_000
      });
      return url;
    }
    if (this.provider === 'supabase') {
      const response = await this.supabaseRequest(
        `/object/sign/${encodeURIComponent(this.supabaseBucket())}/${encodeURIComponent(objectKey)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 120 }) }
      );
      if (!response.ok) throw new InternalServerErrorException(`Supabase Storage signed URL request failed (${response.status})`);
      const result = await response.json() as { signedURL?: unknown };
      if (typeof result.signedURL !== 'string' || !result.signedURL) {
        throw new InternalServerErrorException('Supabase Storage returned an invalid signed URL');
      }
      const path = result.signedURL.startsWith('/storage/v1/')
        ? result.signedURL
        : `/storage/v1/${result.signedURL.replace(/^\/+/, '')}`;
      return new URL(path, this.supabaseUrl).toString();
    }
    return undefined;
  }

  localFile(objectKey: string): string {
    this.assertKey(objectKey);
    return this.localPath(objectKey);
  }

  async delete(objectKey: string): Promise<void> {
    this.assertKey(objectKey);
    if (this.provider === 'gcs' && this.bucketName && this.storage) {
      await this.storage.bucket(this.bucketName).file(objectKey).delete({ ignoreNotFound: true });
      return;
    }
    if (this.provider === 'supabase') {
      const response = await this.supabaseRequest(
        `/object/${encodeURIComponent(this.supabaseBucket())}`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [objectKey] }) }
      );
      if (!response.ok) throw new InternalServerErrorException(`Supabase Storage delete failed (${response.status})`);
      return;
    }
    try { await unlink(this.localPath(objectKey)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async readLocal(objectKey: string): Promise<Buffer> {
    return readFile(this.localFile(objectKey));
  }

  private localPath(objectKey: string): string {
    this.assertKey(objectKey);
    const root = resolve(process.env.STORAGE_DIR ?? '.data/private-images');
    const destination = resolve(root, objectKey);
    if (!destination.startsWith(`${root}${sep}`)) throw new InternalServerErrorException('Invalid storage key');
    return destination;
  }

  private assertKey(objectKey: string): void {
    if (!KEY_PATTERN.test(objectKey)) throw new InternalServerErrorException('Invalid storage key');
  }

  private supabaseRequest(path: string, init: RequestInit): Promise<Response> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new InternalServerErrorException('Supabase Storage is not configured');
    }
    return fetch(`${this.supabaseUrl}/storage/v1${path}`, {
      ...init,
      headers: {
        ...init.headers,
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`
      }
    });
  }

  private supabaseBucket(): string {
    if (!this.supabaseBucketName) throw new InternalServerErrorException('Supabase Storage bucket is not configured');
    return this.supabaseBucketName;
  }
}
