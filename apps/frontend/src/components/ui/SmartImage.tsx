'use client'

import React, { useState, useCallback } from 'react'
import Image, { type ImageProps } from 'next/image'
import { getStorageUrl } from '@/lib/imagor'

interface SmartImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  storageKey?: string
}

export function SmartImage({ storageKey, className, style, ...props }: SmartImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(props.src)
  const [hasFallback, setHasFallback] = useState(false)

  const handleLoad = useCallback(() => {
    setLoaded(true)
  }, [])

  const handleError = useCallback(() => {
    if (!hasFallback && storageKey) {
      setCurrentSrc(getStorageUrl(storageKey))
      setHasFallback(true)
    }
  }, [hasFallback, storageKey])

  return (
    <div
      className={`relative overflow-hidden ${!loaded ? 'animate-pulse bg-gray-800' : ''}`}
      style={props.fill ? { position: 'relative', width: '100%', height: '100%', ...style } : style}
    >
      <Image
        {...props}
        src={currentSrc}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}
