export const INT_EXT_VALUES = Object.freeze({
  INT: 'INT',
  EXT: 'EXT',
  INT_EXT: 'INT/EXT',
});

export function createCharacterEntry(partial = {}) {
  return {
    name: partial.name ?? '',
    description: partial.description ?? '',
    appearancePrompt: partial.appearancePrompt ?? '',
    ageRange: partial.ageRange ?? '',
    build: partial.build ?? '',
    wardrobe: partial.wardrobe ?? [],
    hairMakeup: partial.hairMakeup ?? '',
    palette: partial.palette ?? [],
    props: partial.props ?? [],
    silhouette: partial.silhouette ?? '',
    continuityAnchors: partial.continuityAnchors ?? [],
    imageUrl: partial.imageUrl ?? null,
    imageBlobKey: partial.imageBlobKey ?? null,
  };
}

export function createLocationEntry(partial = {}) {
  return {
    name: partial.name ?? '',
    description: partial.description ?? '',
    appearancePrompt: partial.appearancePrompt ?? '',
    intExt: partial.intExt ?? INT_EXT_VALUES.INT,
    architecture: partial.architecture ?? '',
    environmentDetails: partial.environmentDetails ?? [],
    palette: partial.palette ?? [],
    lightingMotif: partial.lightingMotif ?? '',
    weatherOptions: partial.weatherOptions ?? [],
    setDressing: partial.setDressing ?? [],
    continuityAnchors: partial.continuityAnchors ?? [],
    imageUrl: partial.imageUrl ?? null,
    imageBlobKey: partial.imageBlobKey ?? null,
  };
}

export function createPropEntry(partial = {}) {
  return {
    name: partial.name ?? '',
    description: partial.description ?? '',
    appearancePrompt: partial.appearancePrompt ?? '',
    imageUrl: partial.imageUrl ?? null,
    imageBlobKey: partial.imageBlobKey ?? null,
  };
}
