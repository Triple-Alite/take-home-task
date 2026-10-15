/// <reference types="multer" />

import { Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { Image } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { detectImageMime } from './image-signature';
import { PrivateStorageService } from './private-storage.service';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export type ImageMetadata = Pick<Image, 'id' | 'originalName' | 'mimeType' | 'sizeBytes' | 'createdAt'>;

@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService,
    private readonly realtime: RealtimeGateway
  ) {}

  async list(): Promise<ImageMetadata[]> {
    const ownerUid = process.env.APP_OWNER_UID;
    if (!ownerUid) throw new NotFoundException('No company is configured');
    return this.prisma.image.findMany({
      where: { company: { ownerUid } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true }
    });
  }

  async upload(uploadedBy: string, file: Express.Multer.File): Promise<ImageMetadata> {
    if (!file?.buffer || file.size > MAX_BYTES) throw new UnsupportedMediaTypeException('Image must be no larger than 5 MiB');
    const detectedMime = detectImageMime(file.buffer);
    if (!detectedMime || !ALLOWED_TYPES.has(detectedMime) || file.mimetype !== detectedMime) {
      throw new UnsupportedMediaTypeException('Only valid JPEG, PNG, or WebP images are accepted');
    }
    const ownerUid = process.env.APP_OWNER_UID;
    if (!ownerUid) throw new NotFoundException('No company is configured');
    const company = await this.prisma.company.findUnique({ where: { ownerUid }, select: { id: true } });
    if (!company) throw new NotFoundException('Submit company information before uploading images');

    const objectKey = await this.storage.store(file.buffer, detectedMime);
    try {
      const image = await this.prisma.image.create({
        data: {
          companyId: company.id,
          uploadedBy,
          objectKey,
          originalName: file.originalname.slice(0, 200),
          mimeType: detectedMime,
          sizeBytes: file.size
        }
      });
      const metadata: ImageMetadata = {
        id: image.id,
        originalName: image.originalName,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        createdAt: image.createdAt
      };
      this.realtime.emitImageUploaded(company.id, metadata);
      return metadata;
    } catch (error) {
      await this.storage.delete(objectKey);
      throw error;
    }
  }

  async getAuthorizedImage(id: string): Promise<Image> {
    const ownerUid = process.env.APP_OWNER_UID;
    const image = await this.prisma.image.findUnique({ where: { id }, include: { company: { select: { ownerUid: true } } } });
    if (!image || !ownerUid || image.company.ownerUid !== ownerUid) throw new NotFoundException('Image not found');
    return image;
  }
}
