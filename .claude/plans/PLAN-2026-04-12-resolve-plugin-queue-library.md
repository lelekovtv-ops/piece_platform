# PLAN: Resolve Plugin — Queue, Duration, Image Input, Library

**Date:** 2026-04-12
**Scope:** apps/resolve-plugin/

## Goal

Add 4 features to PIECE Studio plugin:
1. **Generation queue** — serial queue, up to 10 items
2. **Duration selector** — for video models supporting duration
3. **Image references** — from library, upload, snapshot; upload to tmpfiles.org for URL
4. **Media library** — persistent bottom bar in all views, gallery of generated/uploaded files

---

## File Map

### New Files (11)

| File | Responsibility |
|------|---------------|
| `src/main/ipc/library-handlers.js` | Scan downloads/uploads dirs, import files, delete |
| `src/main/ipc/queue-handlers.js` | Serial queue processing in main process |
| `src/main/utils/upload.js` | Upload local file to tmpfiles.org, return URL |
| `src/renderer/stores/library-store.ts` | Library state: items, selected refs, loading |
| `src/renderer/stores/queue-store.ts` | Queue state: items, processing status |
| `src/renderer/components/library/LibraryBar.tsx` | Bottom bar with thumbnail grid, appears in all views |
| `src/renderer/components/library/LibraryGrid.tsx` | Full library grid (when expanded) |
| `src/renderer/components/expanded/DurationInput.tsx` | Duration slider/input for video |
| `src/renderer/components/expanded/ReferenceSelector.tsx` | Pick refs from library + upload + snapshot |
| `src/renderer/components/expanded/QueueList.tsx` | Queue items with status indicators |
| `tests/unit/main/utils/upload.test.js` | Upload utility tests |

### Modified Files (10)

| File | Changes |
|------|---------|
| `src/shared/ipc-channels.js` | Add LIBRARY_CHANNELS, QUEUE_CHANNELS |
| `src/main/preload.js` | Expose library and queue IPC |
| `src/main/index.js` | Register library/queue handlers |
| `src/main/ipc/generation-handlers.js` | Refactor to support queue processing |
| `src/main/ipc/snapshot-handlers.js` | Also copy snapshot to uploads dir |
| `src/renderer/stores/generation-store.ts` | Add queue integration |
| `src/renderer/components/expanded/GenerationPanel.tsx` | Add duration, refs, queue button |
| `src/renderer/components/expanded/ExpandedPanel.tsx` | Add LibraryBar at bottom |
| `src/renderer/constants/providers.ts` | Add durationRange, maxReferences per provider |
| `src/renderer/types/window-api.d.ts` | Add library and queue types |

---

## Tasks

### Task 1: IPC channels for library and queue

**File:** `src/shared/ipc-channels.js`

Add:
```javascript
export const LIBRARY_CHANNELS = {
  list: "library:list",
  import: "library:import",
  remove: "library:remove",
  getUrl: "library:get-url",
};

export const QUEUE_CHANNELS = {
  add: "queue:add",
  list: "queue:list",
  cancel: "queue:cancel",
  clear: "queue:clear",
  onUpdate: "queue:on-update",
};
```

### Task 2: Upload utility

**File:** `src/main/utils/upload.js`

Upload local file to tmpfiles.org (free, no auth):
```javascript
import { readFileSync } from "fs";
import { basename } from "path";

export async function uploadFileForUrl(filePath) {
  const fileName = basename(filePath);
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer]);
  const form = new FormData();
  form.append("file", blob, fileName);

  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  // tmpfiles.org returns { data: { url: "https://tmpfiles.org/12345/file.png" } }
  // Convert to direct URL: https://tmpfiles.org/dl/12345/file.png
  const viewUrl = data.data?.url;
  if (!viewUrl) throw new Error("Upload returned no URL");
  return viewUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}
```

**Test:** `tests/unit/main/utils/upload.test.js` — mock fetch, verify URL transform.

### Task 3: Library handlers (main process)

**File:** `src/main/ipc/library-handlers.js`

```javascript
// Scans ~/.piece-studio/downloads/ and ~/.piece-studio/uploads/
// Returns array of { id, name, path, type (image|video|audio), url?, createdAt, size }
// import: copies external file to uploads/
// remove: deletes file
// getUrl: for files with known Sjinn CDN url, return it; otherwise upload via uploadFileForUrl
```

Library manifest stored as `~/.piece-studio/library.json` — maps filePath → { originalUrl, createdAt, provider }.
Updated on each generation completion and file import.

### Task 4: Queue handlers (main process)

**File:** `src/main/ipc/queue-handlers.js`

Serial queue processor:
- `add(item)` — push to queue (max 10), return queue
- `list()` — return current queue state
- `cancel(itemId)` — remove from queue or cancel if active
- `clear()` — clear pending items
- Processes one item at a time using existing generation logic
- Sends `queue:on-update` events to renderer via mainWindow.webContents.send()

Queue item shape:
```typescript
{
  id: string;           // crypto.randomUUID()
  providerId: string;
  prompt: string;
  apiKey: string;
  duration?: number;
  referenceImages?: string[];  // URLs
  status: "pending" | "generating" | "done" | "error";
  result?: { clipName: string; filePath: string };
  error?: string;
  createdAt: number;
}
```

### Task 5: Update preload.js

Add library and queue namespaces:
```javascript
library: {
  list: () => ipcRenderer.invoke(LIBRARY_CHANNELS.list),
  import: (filePath) => ipcRenderer.invoke(LIBRARY_CHANNELS.import, filePath),
  remove: (id) => ipcRenderer.invoke(LIBRARY_CHANNELS.remove, id),
  getUrl: (id) => ipcRenderer.invoke(LIBRARY_CHANNELS.getUrl, id),
},
queue: {
  add: (item) => ipcRenderer.invoke(QUEUE_CHANNELS.add, item),
  list: () => ipcRenderer.invoke(QUEUE_CHANNELS.list),
  cancel: (id) => ipcRenderer.invoke(QUEUE_CHANNELS.cancel, id),
  clear: () => ipcRenderer.invoke(QUEUE_CHANNELS.clear),
  onUpdate: (cb) => ipcRenderer.on(QUEUE_CHANNELS.onUpdate, (_e, data) => cb(data)),
},
```

### Task 6: Update window-api.d.ts

Add library and queue types to Window.api interface.

### Task 7: Register handlers in index.js

Import and call `registerLibraryHandlers` and `registerQueueHandlers` in `registerIpcHandlers()`.

### Task 8: Provider metadata — duration and references

**File:** `src/renderer/constants/providers.ts`

Add optional fields per provider:
```typescript
{ id: string; name: string; kind: string; keyId: string;
  durationRange?: { min: number; max: number; default: number };
  maxReferences?: number; }
```

Providers with duration:
- sjinn-grok-text: { min: 3, max: 15, default: 5 }
- sjinn-grok-image: { min: 3, max: 15, default: 5 }
- sjinn-sora2-text: { min: 10, max: 15, default: 10 }
- sjinn-sora2-image: { min: 10, max: 15, default: 10 }
- sjinn-kling3-text: { min: 3, max: 15, default: 5 }
- sjinn-kling3-image: { min: 3, max: 15, default: 5 }

Providers with references:
- sjinn-nano-banana: maxReferences: 8
- sjinn-nano-banana-pro: maxReferences: 8
- sjinn-nano-banana-2: maxReferences: 8
- sjinn-seedream-v4: maxReferences: 8
- sjinn-seedream-v5: maxReferences: 8
- sjinn-veo3-image: maxReferences: 1
- sjinn-sora2-image: maxReferences: 1
- sjinn-grok-image: maxReferences: 1
- sjinn-kling3-image: maxReferences: 1
- sjinn-lipsync: maxReferences: 1 (+ needs audio URL)

### Task 9: DurationInput component

**File:** `src/renderer/components/expanded/DurationInput.tsx`

Simple number input with min/max/step labels. Shows only when selected provider has `durationRange`.

### Task 10: Snapshot handler update

**File:** `src/main/ipc/snapshot-handlers.js`

After capturing snapshot, also copy to `~/.piece-studio/uploads/` and add to library manifest.
Return `{ filePath, libraryId }`.

### Task 11: Library stores (renderer)

**File:** `src/renderer/stores/library-store.ts`

```typescript
interface LibraryItem {
  id: string;
  name: string;
  path: string;
  type: "image" | "video" | "audio";
  url?: string;
  createdAt: number;
  size: number;
}

interface LibraryState {
  items: LibraryItem[];
  selectedRefs: string[];  // item IDs selected as references
  loading: boolean;
  loadItems: () => Promise<void>;
  toggleRef: (id: string, max: number) => void;
  clearRefs: () => void;
  importFile: () => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}
```

### Task 12: Queue store (renderer)

**File:** `src/renderer/stores/queue-store.ts`

Syncs with main process via IPC. Listens to `queue:on-update` for real-time updates.

### Task 13: ReferenceSelector component

**File:** `src/renderer/components/expanded/ReferenceSelector.tsx`

Shows when provider has `maxReferences > 0`:
- Mini thumbnail strip of selected refs
- "From Library" button → toggles library selection mode
- "Upload" button → file dialog via IPC
- "Snapshot" button → capture from Resolve
- Count badge: "2/8 refs"

### Task 14: Update GenerationPanel

**File:** `src/renderer/components/expanded/GenerationPanel.tsx`

Changes:
- Add `<DurationInput>` (shows only when provider has durationRange)
- Add `<ReferenceSelector>` (shows only when provider has maxReferences)
- Change "Generate" button to "Add to Queue" when queue has items
- Show `<QueueList>` below status
- Pass duration and referenceImages to generation.run

### Task 15: QueueList component

**File:** `src/renderer/components/expanded/QueueList.tsx`

Compact list of queue items with:
- Status icon (pending=clock, generating=spinner, done=check, error=x)
- Provider name + truncated prompt
- Cancel button per item
- "Clear All" button

### Task 16: LibraryBar component

**File:** `src/renderer/components/library/LibraryBar.tsx`

Persistent bottom bar (48px height) in ALL views (ExpandedPanel, and even auth/license screens):
- Horizontal scroll of thumbnails
- Click thumbnail → select as reference (when in generation mode)
- Small "Library" label + expand button
- When expanded → shows full LibraryGrid overlay

### Task 17: LibraryGrid component

**File:** `src/renderer/components/library/LibraryGrid.tsx`

Full overlay/panel with:
- Grid of thumbnails (3 columns)
- File type badges (img/vid/aud)
- Delete button per item
- Import button (opens file dialog)
- Close button

### Task 18: Integrate LibraryBar into ExpandedPanel

**File:** `src/renderer/components/expanded/ExpandedPanel.tsx`

Add `<LibraryBar />` at the bottom of the layout, before the footer.

### Task 19: Update generation-handlers for queue

**File:** `src/main/ipc/generation-handlers.js`

- Accept `duration` and `referenceImages` params
- Pass `duration` as extra param to provider.generate()
- For referenceImages: if URLs, pass directly; if local paths, upload via uploadFileForUrl first
- For image_list providers (Nano Banana), pass as `image_list` input
- For i2v providers (Veo3, Sora2, etc.), pass as `image` input

### Task 20: Update tests

- Update `generation-handlers.test.js` for new params
- Update `snapshot-handlers.test.js` for library integration
- Add `upload.test.js`
- Add `library-handlers.test.js` (mock fs)
- Add `queue-handlers.test.js`
- Update `bootstrap.test.js` if provider count changes

### Task 21: Final audit

- `pnpm exec vitest run` — all pass
- `pnpm run build` — success
- Install and verify in Resolve:
  - Generate image → appears in library bar
  - Select from library as reference → generate i2v
  - Snapshot from Resolve → appears in library
  - Queue multiple generations → process serially
  - Duration slider works for Grok/Kling3

---

## Execution Order

Phase 1 (Infrastructure): Tasks 1, 2, 3, 4, 5, 6, 7
Phase 2 (Provider metadata): Task 8
Phase 3 (UI components): Tasks 9, 11, 12, 13, 15, 16, 17
Phase 4 (Integration): Tasks 10, 14, 18, 19
Phase 5 (Tests + Audit): Tasks 20, 21
