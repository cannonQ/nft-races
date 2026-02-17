import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PetImageProps {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
}

export function PetImage({ src, fallbackSrc, alt, className }: PetImageProps) {
  const [useFallback, setUseFallback] = useState(false);

  const activeSrc = useFallback ? fallbackSrc : src;

  if (!activeSrc) return null;

  return (
    <img
      src={activeSrc}
      alt={alt}
      loading="lazy"
      width={64}
      height={64}
      className={cn('object-cover', className)}
      onError={() => {
        if (!useFallback && fallbackSrc) {
          setUseFallback(true);
        }
      }}
    />
  );
}
