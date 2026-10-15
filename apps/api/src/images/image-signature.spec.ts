import { detectImageMime } from './image-signature';

describe('detectImageMime', () => {
  it('accepts PNG, JPEG, and WebP signatures', () => {
    expect(detectImageMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectImageMime(Buffer.from('RIFF0000WEBP'))).toBe('image/webp');
  });

  it('rejects short, unknown, and extension-only content', () => {
    expect(detectImageMime(Buffer.from([137, 80, 78]))).toBeUndefined();
    expect(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeUndefined();
  });
});
