/// <reference types="multer" />

import { Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { Image } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { detectImageMime } from './image-signature';
import { ListImagesDto } from './list-images.dto';
import { PrivateStorageService } from './private-storage.service';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export type ImageMetadata = Pick<Image, 'id' | 'originalName' | 'mimeType' | 'sizeBytes' | 'createdAt'>;
export type PaginatedImages = { items: ImageMetadata[]; page: number; limit: number; total: number };

@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService,
    private readonly realtime: RealtimeGateway
  ) {}

  async list(user: AuthenticatedUser, query: ListImagesDto): Promise<PaginatedImages> {
    const company = await this.prisma.company.findFirst({
      where: user.role === 'USER_A' ? { ownerId: user.id } : { collaboratorId: user.id },
      select: { id: true }
    });
    if (!company) return { items: [], page: query.page, limit: query.limit, total: 0 };
    const where = { companyId: company.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true }
      }),
      this.prisma.image.count({ where })
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  async upload(uploadedBy: AuthenticatedUser, file: Express.Multer.File): Promise<ImageMetadata> {
    if (uploadedBy.role !== 'USER_B') {
      throw new NotFoundException('Image uploads are available to the assigned collaborator only');
    }
    if (!file?.buffer || file.size > MAX_BYTES) throw new UnsupportedMediaTypeException('Image must be no larger than 5 MiB');
    const detectedMime = detectImageMime(file.buffer);
    if (!detectedMime || !ALLOWED_TYPES.has(detectedMime) || file.mimetype !== detectedMime) {
      throw new UnsupportedMediaTypeException('Only valid JPEG, PNG, or WebP images are accepted');
    }
    const company = await this.prisma.company.findFirst({
      where: { collaboratorId: uploadedBy.id },
      select: { id: true, ownerId: true, collaboratorId: true }
    });
    if (!company) throw new NotFoundException('Submit company information before uploading images');

    const objectKey = await this.storage.store(file.buffer, detectedMime);
    try {
      const image = await this.prisma.image.create({
        data: {
          companyId: company.id,
          uploadedBy: uploadedBy.uid,
          uploadedById: uploadedBy.id,
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
      this.realtime.emitImageUploaded(company.id, metadata, {
        ownerId: company.ownerId,
        collaboratorId: company.collaboratorId
      });
      return metadata;
    } catch (error) {
      await this.storage.delete(objectKey);
      throw error;
    }
  }

  async getAuthorizedImage(id: string, user: AuthenticatedUser): Promise<Image> {
    const companyRelation = user.role === 'USER_A' ? { ownerId: user.id } : { collaboratorId: user.id };
    const image = await this.prisma.image.findFirst({
      where: { id, company: companyRelation }
    });
    if (!image) throw new NotFoundException('Image not found');
    return image;
  }
}
