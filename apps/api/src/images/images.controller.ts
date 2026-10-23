/// <reference types="multer" />

import { Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ImageMetadata, ImagesService, PaginatedImages } from './images.service';
import { ListImagesDto } from './list-images.dto';
import { PrivateStorageService } from './private-storage.service';

@ApiTags('images')
@ApiBearerAuth()
@Controller('company/me/images')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ImagesController {
  constructor(private readonly images: ImagesService, private readonly storage: PrivateStorageService) {}

  @Get()
  @Roles('USER_A', 'USER_B')
  @ApiOperation({ summary: 'List image metadata for the company; owner and collaborator' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListImagesDto): Promise<PaginatedImages> {
    return this.images.list(user, query);
  }

  @Post()
  @Roles('USER_B')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @ApiOperation({ summary: 'Upload a private JPEG, PNG, or WebP image (collaborator only)' })
  upload(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File): Promise<ImageMetadata> {
    return this.images.upload(user, file);
  }

  @Get(':id/access')
  @Roles('USER_A', 'USER_B')
  @ApiOperation({ summary: 'Read an image after checking company access; cloud storage uses a 2-minute signed URL' })
  async read(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() response: Response): Promise<void> {
    const image = await this.images.getAuthorizedImage(id, user);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const signedUrl = await this.storage.readUrl(image.objectKey);
    if (signedUrl) {
      response.redirect(302, signedUrl);
      return;
    }
    response.type(image.mimeType);
    response.sendFile(this.storage.localFile(image.objectKey), (error) => {
      if (error && !response.headersSent) response.status(404).end();
    });
  }
}
