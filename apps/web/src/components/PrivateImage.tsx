'use client';

import { useEffect, useState } from 'react';
import { apiFile, CompanyImage } from '@/lib/api';

export function PrivateImage({ image }: { image: CompanyImage }) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void apiFile(`/images/${encodeURIComponent(image.id)}`)
      .then((response) => response.blob())
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  return (
    <figure className="image-item">
      <div className="image-frame">
        {source ? <img src={source} alt={image.originalName} /> : <span>{failed ? 'Image unavailable' : 'Loading image'}</span>}
      </div>
      <figcaption>
        <span title={image.originalName}>{image.originalName}</span>
        <time dateTime={image.createdAt}>{new Date(image.createdAt).toLocaleDateString()}</time>
      </figcaption>
    </figure>
  );
}
