import { InternalServerErrorException } from '@nestjs/common';
import { PrivateStorageService } from './private-storage.service';

describe('PrivateStorageService with Supabase Storage', () => {
  const originalEnv = { ...process.env };
  let storage: PrivateStorageService;

  beforeEach(() => {
    process.env.STORAGE_PROVIDER = 'supabase';
    process.env.SUPABASE_URL = 'https://project.supabase.co/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'private-images';
    storage = new PrivateStorageService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('uploads image bytes to the configured bucket with service authorization', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const key = await storage.store(Buffer.from('image-data'), 'image/png');

    expect(key).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://project.supabase.co/storage/v1/object/private-images/${key}`,
      expect.objectContaining({
        method: 'POST',
        body: Buffer.from('image-data'),
        headers: expect.objectContaining({
          apikey: 'service-role-key',
          Authorization: 'Bearer service-role-key',
          'Content-Type': 'image/png',
          'x-upsert': 'false'
        })
      })
    );
  });

  it('returns a short-lived signed URL for private object reads', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ signedURL: '/object/sign/private-images/abc.png?token=temporary' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));

    await expect(storage.readUrl('123e4567-e89b-12d3-a456-426614174000.png'))
      .resolves.toBe('https://project.supabase.co/storage/v1/object/sign/private-images/abc.png?token=temporary');
  });

  it('deletes objects by bucket prefix', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const key = '123e4567-e89b-12d3-a456-426614174000.webp';
    await storage.delete(key);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.supabase.co/storage/v1/object/private-images',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ prefixes: [key] })
      })
    );
  });

  it('surfaces storage service failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    await expect(storage.store(Buffer.from('image-data'), 'image/jpeg'))
      .rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
