'use client'

import React, { useState, useCallback } from 'react'
import { getStorageUrl } from '@/lib/imagor'

interface SmartImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  storageKey?: string
}

export function SmartImg({ storageKey, className, loading = 'lazy', style, ...props }: SmartImgProps) {
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
      style={style}
    >
      <img
        {...props}
        src={currentSrc}
        loading={loading}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}
