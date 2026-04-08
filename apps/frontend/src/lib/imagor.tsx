'use client';

import React, { useState, useCallback } from 'react';

/**
 * Get the thumbnail URL for an S3 key.
 * URLs come pre-signed from the API — no secret needed on frontend.
 */
export function getThumbnailUrl(key: string): string {
  return `/storage/koza-uploads/${key}`;
}

/**
 * Get the preview URL for an S3 key.
 */
export function getPreviewUrl(key: string): string {
  return `/storage/koza-uploads/${key}`;
}

/**
 * Build a direct storage URL (fallback when imagor is unavailable).
 */
export function getStorageUrl(key: string): string {
  return `/storage/koza-uploads/${key}`;
}

interface ImagorImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Pre-signed imagor URL (from API response thumbnailUrl/previewUrl) */
  src: string;
  /** S3 key for fallback to direct storage URL */
  storageKey?: string;
  /** Alt text */
  alt: string;
}

/**
 * Image component with automatic fallback from imagor to direct storage URL.
 * If imagor is down, onError fires and we switch to /storage/ URL.
 */
export function ImagorImage({ src, storageKey, alt, ...props }: ImagorImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasFallback, setHasFallback] = useState(false);

  const handleError = useCallback(() => {
    if (!hasFallback && storageKey) {
      setCurrentSrc(getStorageUrl(storageKey));
      setHasFallback(true);
    }
  }, [hasFallback, storageKey]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={handleError}
      {...props}
    />
  );
}
