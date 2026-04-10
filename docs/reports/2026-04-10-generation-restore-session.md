# Session Report: Image Generation & Breakdown Pipeline Restoration

**Date:** 2026-04-10
**Duration:** ~2 hours
**Branch:** dev

## Summary

Restored the image generation pipeline and breakdown system that broke during KOZA migration. Also migrated all AI services from OpenAI/Anthropic to Google Gemini as the single provider.

## Problems Found & Fixed

### 1. Gemini Model Name (ROOT CAUSE of generation failure)

**Symptom:** Image generation hung forever (60+ second timeout, no response)

**Cause:** Model `gemini-3.1-flash-image-preview` was set in two files but this model hangs without responding. The original working models (`gemini-2.0-flash` and `gemini-2.5-flash-image`) were changed during migration.

**Fix:** Reverted both files to `gemini-2.5-flash-image` (tested: generates images in ~7-9 seconds)

| File | Before | After |
|------|--------|-------|
| `apps/backend/piece/src/modules/generation/services/gemini-image.js:25` | `gemini-3.1-flash-image-preview` | `gemini-2.5-flash-image` |
| `apps/backend/piece/src/modules/koza-tools/services/nano-banana.js:48` | `gemini-3.1-flash-image-preview` | `gemini-2.5-flash-image` |

### 2. Koza-Tools Services Migrated to Gemini

All 4 koza-tools services were using Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) which were not installed. Rewrote them to use `@google/genai` and `chatCompletion()` from `providers.js`.

| Service | Was | Now |
|---------|-----|-----|
| `ambient-image.js` | OpenAI DALL-E 3 via `@ai-sdk/openai` | Gemini `gemini-2.5-flash-image` via `@google/genai` |
| `ambient-prompt.js` | Anthropic Claude via `@ai-sdk/anthropic` | Gemini via `chatCompletion()` |
| `classify-intent.js` | Anthropic Haiku via `@ai-sdk/anthropic` | Gemini via `chatCompletion()` |
| `smart-distribute.js` | Anthropic Claude via `generateObject` | Gemini via `chatCompletion()` + JSON parse + Zod validation |

Vercel AI SDK deps (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) removed from `package.json`.

### 3. Frontend Breakdown Pipeline Updated

| File | Change |
|------|--------|
| `apps/frontend/src/lib/fincher.ts:353` | Fallback chain: `claude/gpt/gemini-lite` -> `gemini-flash/gemini-lite/gemini-pro` |
| `apps/frontend/src/lib/fincher.ts:544` | Primary model: `gemini-2.5-flash-lite` -> `gemini-2.5-flash` |
| `apps/frontend/src/lib/api/chat-adapter.ts:88` | Default provider: Anthropic -> Google Gemini |

### 4. Generation Controller Improvements (pre-existing, kept)

`apps/backend/piece/src/modules/generation/controller.js` — changed from `res.json(result)` to binary buffer response (handles both base64 and URL results correctly). This was already in the working tree and is correct.

### 5. Backend Providers Updated (pre-existing, kept)

`apps/backend/piece/src/modules/ai/services/providers.js`:
- Default Google model: `gemini-2.0-flash` -> `gemini-2.5-flash-lite`
- Added Google streaming support in `streamChatCompletion()`

## Verification Results

| Endpoint | Status | Details |
|----------|--------|---------|
| `POST /v1/tools/nano-banana` | OK | PNG 1344x768, ~9s |
| `POST /v1/projects/.../generate/image?provider=google` | OK | PNG 1024x1024, ~9s |
| `POST /v1/projects/.../generate/image?provider=openai` | FAIL | Billing limit (key issue, not code) |
| `POST /v1/chat` (Anthropic) | OK | Claude Sonnet working |
| `POST /v1/chat` (Google) | OK | Gemini 2.5 Flash working |
| `POST /v1/chat?stream=true` (Google) | OK | SSE streaming working |
| `POST /v1/tools/classify-intent` | OK | Returns correct intent |
| `POST /v1/tools/ambient-prompt` | OK | Returns enhanced prompt |
| `POST /v1/tools/ambient-image` | OK | PNG 1344x768 via Gemini |
| `GET /v1/system/capabilities` | OK | All 3 providers configured |

## Files Modified

### Backend
- `apps/backend/piece/package.json` — removed `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`
- `apps/backend/piece/src/modules/generation/services/gemini-image.js` — model fix
- `apps/backend/piece/src/modules/koza-tools/services/nano-banana.js` — model fix
- `apps/backend/piece/src/modules/koza-tools/services/ambient-image.js` — rewritten to Gemini
- `apps/backend/piece/src/modules/koza-tools/services/ambient-prompt.js` — rewritten to Gemini
- `apps/backend/piece/src/modules/koza-tools/services/classify-intent.js` — rewritten to Gemini
- `apps/backend/piece/src/modules/koza-tools/services/smart-distribute.js` — rewritten to Gemini

### Frontend
- `apps/frontend/src/lib/fincher.ts` — Gemini fallback chain + primary model
- `apps/frontend/src/lib/api/chat-adapter.ts` — default provider to Google
- `apps/frontend/src/lib/api/endpoints.ts` — API_BASE changed (see known issues)
- `apps/frontend/next.config.ts` — rewrites added (see known issues)

## Known Issues (NOT fixed, need separate session)

### Auth/Session Persistence Problem

**Symptom:** Page refresh loses session, Bible redirects to login, password "doesn't work"

**Root Cause:** Cross-origin cookie delivery between frontend (`:5201`) and backend (`:4030`).

- Cookie `piece_rt` is set by backend at `localhost:4030`
- Frontend at `localhost:5201` sends `refreshApi()` with `credentials: "include"`
- `sameSite: 'lax'` should work (same-site), but Incognito mode may block it
- Added Next.js rewrites as proxy attempt, changed `API_BASE` to `""`, but Next.js rewrites don't properly forward `Set-Cookie` headers

**Recommended Fix (next session):**

1. Revert `API_BASE` to `"http://localhost:4030"` and remove rewrites
2. Create proper Next.js API route proxy (`/api/auth/[...path]`) that forwards cookies
3. OR: In dev mode, skip auth redirect in AuthProvider when refresh fails
4. OR: Store access token in `sessionStorage` to survive F5 refreshes

**Files to fix:**
- `apps/frontend/src/lib/api/endpoints.ts` — revert API_BASE
- `apps/frontend/next.config.ts` — remove rewrites
- `apps/frontend/src/components/app/AuthProvider.tsx` — dev mode handling
- Possibly create `apps/frontend/src/app/api/auth/[...path]/route.ts` as cookie proxy

### OpenAI Billing

`OPENAI_API_KEY` has hit billing limit. Image generation via OpenAI returns `400 Billing hard limit has been reached`. Need to update key or add balance.
