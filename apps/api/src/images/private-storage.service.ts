import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

@Injectable()
export class PrivateStorageService implements OnModuleInit {
  private readonly bucketName = process.env.GCS_BUCKET;
  private readonly storage = this.bucketName ? new Storage() : undefined;

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'production' && !this.bucketName) {
      throw new Error('GCS_BUCKET must be configured in production; local ephemeral storage is disabled');
    }
  }

  async store(bytes: Buffer, mimeType: string): Promise<string> {
    const extension = EXTENSIONS[mimeType];
    if (!extension) throw new InternalServerErrorException('Unsupported storage media type');
    const objectKey = `${randomUUID()}.${extension}`;
    if (this.bucketName && this.storage) {
      await this.storage.bucket(this.bucketName).file(objectKey).save(bytes, {
        resumable: false,
        validation: 'crc32c',
        metadata: { contentType: mimeType, cacheControl: 'private, no-store' }
      });
      return objectKey;
    }
    const destination = this.localPath(objectKey);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
    return objectKey;
  }

  async readUrl(objectKey: string): Promise<string | undefined> {
    this.assertKey(objectKey);
    if (!this.bucketName || !this.storage) return undefined;
    const [url] = await this.storage.bucket(this.bucketName).file(objectKey).getSignedUrl({
      version: 'v4', action: 'read', expires: Date.now() + 120_000
    });
    return url;
  }

  localFile(objectKey: string): string {
    this.assertKey(objectKey);
    return this.localPath(objectKey);
  }

  async delete(objectKey: string): Promise<void> {
    this.assertKey(objectKey);
    if (this.bucketName && this.storage) {
      await this.storage.bucket(this.bucketName).file(objectKey).delete({ ignoreNotFound: true });
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
}
