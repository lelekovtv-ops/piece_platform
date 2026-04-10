export function computeVisionHash(
  direction: string,
  shotType: string,
  lens: string,
  cameraMove: string,
): string {
  const raw = `${direction}|${shotType}|${lens}|${cameraMove}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

export function isStale(
  currentHash: string,
  lastGenerationHash: string | null,
): boolean {
  if (!lastGenerationHash) return false
  return currentHash !== lastGenerationHash
}
