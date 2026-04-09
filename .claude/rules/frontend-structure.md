# Frontend Structure

## Overview

Next.js 16 App Router + React 19 + TypeScript. Feature-rich cinematic production platform.

Location: `apps/frontend/src/`

## Directory Layout

```
src/
├── app/              # Next.js App Router (route pages)
├── components/       # Shared UI components
├── features/         # Feature modules (breakdown)
├── hooks/            # Custom React hooks
├── lib/              # Domain logic, utilities, API clients
├── store/            # Zustand stores
└── types/            # TypeScript type definitions
```

## Routes (`src/app/`)

| Route | Feature |
|-------|---------|
| `/home` | Dashboard |
| `/login` | Authentication |
| `/projects` | Project list |
| `/project` | Single project view |
| `/screenplay` | Script editor (Slate) |
| `/rundown` | Timing/structure editor |
| `/bible` | Characters, locations, props reference |
| `/library` | Asset library |
| `/board` | Storyboard editor |
| `/studio` | Breakdown studio |
| `/piece` | Piece viewer |
| `/production` | Production view |
| `/scriptwriter` | AI script generation |
| `/export` | Export functionality |
| `/settings` | User/team settings |
| `/workspace` | Workspace management |
| `/dev` | Development tools (8 sub-routes) |
| `/healthz` | Health check endpoint |

## Zustand Stores (`src/store/`)

23 specialized stores organized by domain:

### Core Data
- `projects.ts` -- project CRUD, selection
- `bible.ts` -- characters, locations, props
- `library.ts` -- asset management
- `screenplay.ts` -- (if exists, check `script.ts`)
- `scenes.ts` -- scene data

### Editing
- `script.ts` -- script editing state
- `dialogue.ts` -- dialogue editing
- `rundown.ts` -- rundown editing
- `timeline.ts` -- timeline state
- `storyboard.ts` -- storyboard editing
- `voiceTrack.ts` -- voice/audio tracks
- `board.ts` -- board/canvas state

### UI State
- `panels.ts` -- panel layout
- `theme.ts` -- theme/dark mode
- `navigation.ts` -- nav state
- `devlog.ts` -- dev logging

### Specialized
- `collaboration.ts` -- real-time collaboration
- `pieceSession.ts` -- piece session state
- `breakdown.ts` -- breakdown analysis
- `blockCanvas.ts` -- block canvas state
- `breakdownConfig.ts` -- breakdown settings
- `modifierTemplates.ts` -- modifier template library
- `projectProfiles.ts` -- project profile settings
- `reEditConfig.ts` -- re-edit configuration
- `screenplaySettings.ts` -- screenplay display settings

## Custom Hooks (`src/hooks/`)

| Hook | Domain | Purpose |
|------|--------|---------|
| `useCollaboration` | Real-time | WebSocket collaboration connection |
| `useSceneSync` | Data | Scene synchronization |
| `useSyncOrchestrator` | Data | Multi-store sync coordination |
| `useAutosave` | Data | Debounced auto-save |
| `useBlockLockStatus` | Collaboration | Scene/block lock state |
| `useDirectorMode` | UI | Director mode toggle |
| `useFadeIn` | UI | Fade-in animation |
| `useImagePreloader` | UI | Image preloading |
| `useHandTracking` | Vision | MediaPipe hand tracking |
| `useSpeech` | Audio | Speech recognition/synthesis |

## Library Modules (`src/lib/`)

### Infrastructure
- `auth/` -- authentication (auth-client, auth-store, auth-fetch)
- `api/` -- API client functions and endpoints
- `ws/` -- WebSocket utilities
- `router/` -- routing utilities
- `analytics.ts` -- analytics tracking

### Domain Logic
- `cinematic/` -- shot composition, cinematography
- `pipeline/` -- processing pipelines
- `generation/` -- content generation (images, text)
- `canvas/` -- canvas/drawing utilities
- `sam/` -- Segment Anything Model integration
- `importers/` -- file/content importers

### Screenplay/Production
- `screenplayFormat.ts`, `screenplaySerializer.ts` -- screenplay I/O
- `sceneParser.ts` -- scene parsing
- `scriptUtils.ts` -- script utilities
- `rundownBridge.ts`, `rundownBuilder.ts`, `rundownHierarchy.ts` -- rundown management
- `storyboardBridge.ts` -- storyboard integration
- `boardGraphBuilder.ts` -- graph construction
- `bibleParser.ts` -- bible text parsing

### Media/Audio
- `audioEngine.ts` -- audio processing
- `ttsProvider.ts` -- text-to-speech
- `voiceFromRundown.ts` -- voice from rundown data
- `sfxExtractor.ts` -- sound effects extraction
- `imageLoader.ts`, `imagor.tsx` -- image handling
- `imageGenerationReferences.ts` -- AI image refs

### AI/Creative
- `promptAI.ts`, `promptBuilder.ts` -- AI prompt generation
- `cinematographyRules.ts` -- cinematic rules engine
- `colorTransfer.ts` -- color grading
- `moodSynth.ts` -- atmosphere synthesis
- `fincher.ts` -- director style utils
- `intentParser.ts` -- intent parsing

### Utilities
- `fileStorage.ts`, `safeStorage.ts` -- storage abstraction
- `blobAdapter.ts`, `blobUrlTracker.ts` -- blob handling
- `blockEnricher.ts` -- block enrichment
- `durationEngine.ts` -- timing calculations
- `placementEngine.ts` -- layout
- `segmentEngine.ts` -- segmentation
- `shotNumbering.ts` -- shot numbering
- `styleLayer.ts` -- style management
- `syncBus.ts` -- event synchronization
- `themeColors.ts` -- theme colors
- `projectStyle.ts` -- project styling
- `models.ts` -- data models

### Type Definitions
- `breakdownTypes.ts`, `directorTypes.ts`, `productionTypes.ts`
- `rundownTypes.ts`, `screenplayTypes.ts`

## Component Categories (`src/components/`)

| Directory | Purpose |
|-----------|---------|
| `ui/` | Reusable primitives (buttons, inputs, modals) |
| `editor/` | Editor UI components |
| `app/` | Application-level layout |
| `projects/` | Project management UI |
| `piece/` | Piece editor components |
| `board/` | Board/canvas components |
| `director/` | Director/shot composition UI |
| `landing/` | Landing page components |

## Feature Modules (`src/features/`)

Currently one active module:
- `breakdown/` -- scene/shot breakdown analysis

## Key External Libraries

| Library | Usage |
|---------|-------|
| Slate | Screenplay rich text editing |
| @xyflow/react | Pipeline/workflow editor |
| Three.js | 3D scene interactions |
| MediaPipe Tasks Vision | Hand tracking, gesture recognition |
| Zustand | All client state management |
| Tailwind v4 | Utility-first styling |
