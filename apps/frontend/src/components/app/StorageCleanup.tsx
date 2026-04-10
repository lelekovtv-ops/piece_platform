"use client"

import { useEffect } from "react"

export function StorageCleanup() {
  useEffect(() => {
    const cleaned = localStorage.getItem("piece-cleaned-v2")
    if (cleaned) return

    localStorage.removeItem("piece-timeline")
    localStorage.removeItem("piece-storyboard")
    localStorage.setItem("piece-cleaned-v2", "true")
  }, [])

  return null
}