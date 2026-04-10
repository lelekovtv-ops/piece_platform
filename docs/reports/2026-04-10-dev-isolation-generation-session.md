# Session Report: Dev Route Isolation + Image Generation Fix

**Date:** 2026-04-10
**Branch:** dev

---

## 1. Dev Route Isolation (Route Groups)

### Problem
`/dev/*` pages shared root layout with main app — GlobalNav, AuthProvider, ThemeProvider, padding, analytics. Dev tools need full standalone sandbox.

### Solution
Used Next.js Route Groups to fully isolate `/dev` from the project:

```
src/app/
├── (main)/          # Main app with all providers
│   ├── layout.tsx   # AuthProvider, GlobalNav, ThemeProvider, etc.
│   └── [all app routes]
├── (dev)/           # Fully independent — own <html> root layout
│   ├── layout.tsx   # Minimal: just globals.css + dark bg
│   └── dev/
│       ├── layout.tsx           # Nested layout with DevNav
│       ├── _components/DevNav.tsx
│       ├── page.tsx             # Console
│       ├── director-pipeline/
│       ├── breakdown-studio/
│       ├── previz-3d/
│       └── settings/
├── globals.css      # Shared (imported by both)
└── api/
```

### Files Changed
- **Created:** `src/app/(dev)/layout.tsx`, `src/app/(dev)/dev/layout.tsx`, `src/app/(dev)/dev/_components/DevNav.tsx`
- **Moved:** All app routes into `(main)/`, all dev routes into `(dev)/dev/`
- **Edited:** `middleware.ts` — added `/dev` to PUBLIC_ROUTES (no auth required)
- **Cleaned:** Removed redundant headers/back-buttons/bg from dev pages (DevNav replaces them)
- **Build:** Passes, all URLs unchanged

---

## 2. Image Generation — Missing AI SDKs

### Problem
After KOZA → PIECE migration, image generation broken. Backend dynamic-imports AI SDKs (`@google/genai`, `openai`, `@anthropic-ai/sdk`) but they were never added to `package.json`.

### Fix
```bash
pnpm add -F @piece/piece @google/genai openai @anthropic-ai/sdk
```

---

## 3. Generation Controller — JSON vs Binary

### Problem
`generationController.generate` returned JSON (`{ url, b64, provider }`) but frontend `generation/client.ts` calls `res.blob()` expecting binary image data.

### Fix
Updated `apps/backend/piece/src/modules/generation/controller.js`:
- If result has `b64` → convert to Buffer, send as binary with Content-Type
- If result has `url` → fetch image, proxy as binary
- Nano-banana (koza-tools) already returned binary — no change needed

---

## 4. Google API Key Replacement

### Problem
Old `GOOGLE_API_KEY` returned 403 Permission Denied (access revoked).

### Fix
User generated new key at aistudio.google.com and updated `.env.local`.

---

## 5. Model Updates

### Problem
- `gemini-2.0-flash` — removed by Google (404)
- `gemini-2.5-flash` — overloaded (503)
- `gemini-2.5-flash-image` — overloaded (503)

### Working Models Found
| Model | Type | Status |
|-------|------|--------|
| `gemini-2.5-flash-lite` | Text/chat | Working |
| `gemini-3.1-flash-image-preview` | Image (Nano Banana 2) | Working |
| `gemini-3-pro-image-preview` | Image (Nano Banana Pro) | Working |

### Files Updated
- `nano-banana.js` → model changed to `gemini-3.1-flash-image-preview`
- `gemini-image.js` → model changed to `gemini-3.1-flash-image-preview`
- `providers.js` DEFAULT_MODELS.google → `gemini-2.5-flash-lite`
- `fincher.ts` → primaryModel and FALLBACK_MODELS updated to `gemini-2.5-flash-lite`

---

## 6. Google Streaming Support

### Problem
`streamChatCompletion()` in `providers.js` had no `case 'google'` — threw `"Streaming not supported for provider: google"`. Breakdown pipeline (fincher) relies on streaming chat.

### Fix
Added Google streaming via `client.models.generateContentStream()` in `providers.js`.

---

## 7. Auth-fetch Timeout

### Problem
`REQUEST_TIMEOUT_MS = 15_000` in `auth-fetch.ts` — too short for LLM streaming requests that need 20-60s for first response.

### Fix
Increased to `REQUEST_TIMEOUT_MS = 120_000` (2 minutes).

---

## Provider Status (End of Session)

| Provider | Image Gen | Text/Chat Streaming | Notes |
|----------|-----------|-------------------|-------|
| Google | Working (nano-banana via `gemini-3.1-flash-image-preview`) | Working (`gemini-2.5-flash-lite`) | New API key |
| OpenAI | Billing limit | Billing limit | Needs balance top-up |
| SJinn | Working (all models) | N/A | ~3 min per image |
| Anthropic | N/A | Not tested | Key present in .env.local |

---

## Files Modified Summary

### New Files
- `apps/frontend/src/app/(dev)/layout.tsx`
- `apps/frontend/src/app/(dev)/dev/layout.tsx`
- `apps/frontend/src/app/(dev)/dev/_components/DevNav.tsx`

### Backend
- `apps/backend/piece/package.json` — added AI SDK dependencies
- `apps/backend/piece/src/modules/generation/controller.js` — binary response
- `apps/backend/piece/src/modules/generation/services/openai-image.js` — mimeType field
- `apps/backend/piece/src/modules/generation/services/gemini-image.js` — model update
- `apps/backend/piece/src/modules/koza-tools/services/nano-banana.js` — model update
- `apps/backend/piece/src/modules/ai/services/providers.js` — Google streaming + model update

### Frontend
- `apps/frontend/src/middleware.ts` — `/dev` public
- `apps/frontend/src/app/(main)/layout.tsx` — globals.css import path
- `apps/frontend/src/lib/auth/auth-fetch.ts` — timeout 15s → 120s
- `apps/frontend/src/lib/fincher.ts` — model updates
- `apps/frontend/src/store/board.ts` — default model (reverted to nano-banana-2)
- Dev pages: cleaned redundant wrappers/headers

---

## Next Session TODO
- [ ] Test full breakdown pipeline end-to-end (fincher → shots → image generation)
- [ ] Test image generation from StoryboardPanel in main app
- [ ] Top up OpenAI billing to restore gpt-image provider
- [ ] Verify Anthropic API key works for chat fallback
- [ ] Consider adding model health-check endpoint to auto-select working models
