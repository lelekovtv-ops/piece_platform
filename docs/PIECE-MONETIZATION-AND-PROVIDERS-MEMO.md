# PIECE Studio — Monetization, Providers & Architecture Memo

**Created:** 2026-04-12
**Status:** Strategic memo, not yet a plan
**Scope:** Billing model, provider strategy, technical architecture, risks
**Owner:** Alex
**Decision deadline:** Before starting billing module implementation

---

## Document Purpose

This memo captures all decisions, research, and open questions discussed during the planning sessions for PIECE billing and the PIECE Studio Resolve plugin. It is intended as the source of truth for monetization strategy and provider integration decisions. This is not an implementation plan — it is the context that any implementation plan should be built on.

---

## 1. Strategic Framing

### 1.1 Why billing belongs to PIECE, not to the plugin

The original framing treated the Resolve plugin as a standalone commercial product needing its own billing system. This was incorrect.

The correct framing: **billing is a core feature of PIECE as a SaaS platform.** Every AI generation costs real money to providers, which means PIECE cannot exist as a free service at any meaningful scale. The platform must monetize through subscription, credits, or pay-per-use — there is no third option for a sustainable business.

The Resolve plugin is the **first commercial client** of PIECE billing infrastructure. It is not a separate billing system. The same backend serves:
- Web users of the main PIECE platform
- Resolve plugin users
- Any future clients (Premiere plugin, Final Cut plugin, mobile app, etc.)

This unification has critical implications:
- One Stripe/Lemon Squeezy account for everything
- One credit ledger across all clients
- One pricing structure across web and plugin
- One source of truth for user licenses
- The plugin reuses 100% of existing PIECE auth and billing infrastructure

### 1.2 Why the plugin is the ideal first commercial client

The plugin has three properties that make it a strong canary deployment for billing:

**Lower complexity surface.** The plugin uses only auth + billing + provider calls. It does not exercise screenplay editor, rundown builder, timeline view, breakdown studio, or other PIECE features. This isolates billing from other potential failure points.

**More tolerant audience.** Resolve users are professionals who pay for software regularly. They are more forgiving of early-stage bugs than AI creators who churn instantly when something breaks.

**Faster path to revenue.** The plugin can ship with a smaller scope than full PIECE. Validating the billing system on plugin users first reduces risk for the main PIECE launch.

### 1.3 What this means for prioritization

Billing should be added to the PIECE MVP scope. This is a scope expansion that may push the MVP launch from 2026-05-02 by 2-3 weeks. The trade-off is acceptable because launching PIECE without billing has no commercial path forward.

Suggested scope adjustment for the MVP:
- **Add:** Credit ledger, Stripe/Lemon Squeezy integration, generation queue, tier system
- **Defer:** Board feature (creative ideation workspace) — useful for retention but not blocking the first end-to-end experience

---

## 2. Monetization Model

### 2.1 The three industry-standard models

**Model A — Pure subscription with monthly limit.** Fixed price, fixed credit pool, credits expire monthly. Used by Midjourney, Runway, ChatGPT Plus. Simple and predictable for users and operators, but creates resentment when credits expire unused, and forces heavy users into upgrades.

**Model B — Pure pay-as-you-go credits.** Buy credits once, no expiry. Used by OpenAI API, fal.ai, Replicate. Fair to users but unpredictable revenue and harder to plan provider costs.

**Model C — Hybrid (recommended).** Monthly subscription with rolling credits up to N months, plus ability to buy additional credit packs. Used by Cursor, Krea, Linear, Midjourney with rollover. Combines MRR predictability with user fairness.

### 2.2 Recommended model: Hybrid

The hybrid model handles all three user archetypes:
- **Regular users** want subscription predictability
- **Seasonal users** need rollover so credits do not vanish during low-activity months
- **Heavy users** need top-up packs without forcing tier upgrades

Pure subscription excludes types 2 and 3. Pure pay-as-you-go kills MRR. Hybrid serves all three.

### 2.3 Credit unit design — the most important concept

**One credit is not equal to one generation.** Different generations cost radically different amounts to operate. A simple Flux Schnell image costs $0.003 to operate; a Sora 2 Pro 1080p clip costs $5.00. That is a 1666x difference. Treating them as equal credits creates either bankruptcy (if 1 credit = 1 generation) or sticker shock (if 1 credit = $0.001 → Sora 2 costs 5000 credits per video).

**Correct approach: credits proportional to operator cost.**

Internal accounting unit: **1 credit = $0.005**.

Example credit pricing with ~50% margin built in:

| Action | Real Cost (USD) | Credits | User Sees |
|---|---|---|---|
| SDXL image | $0.002 | 1 | $0.005 |
| Flux Schnell image | $0.003 | 1 | $0.005 |
| Flux Pro image | $0.025 | 8 | $0.04 |
| Nano Banana / Gemini Flash Image | $0.06 | 18 | $0.09 |
| FLUX.2 Pro image | $0.05 | 15 | $0.075 |
| Kling Turbo 5 sec | $0.35 | 100 | $0.50 |
| Kling 3.0 Pro 5 sec with audio | $0.84 | 250 | $1.25 |
| Veo 3.1 Fast 5 sec 720p | $0.50 | 150 | $0.75 |
| Veo 3.1 5 sec without audio | $1.00 | 300 | $1.50 |
| Veo 3.1 5 sec with audio | $2.00 | 600 | $3.00 |
| Sora 2 Pro 5 sec 720p | $1.50 | 450 | $2.25 |
| Sora 2 Pro 5 sec 1080p | $2.50 | 750 | $3.75 |
| Hailuo 2.3 Pro 1080p | $0.49 | 150 | $0.75 |
| ElevenLabs TTS 1000 chars | $0.30 | 90 | $0.45 |
| Stable Audio 1 min | $0.10 | 30 | $0.15 |

**UI principle:** users see only credit costs, not dollars. Each generation button displays its cost in credits. A confirmation modal appears for any action over 200 credits showing "This will cost X credits, you'll have Y remaining". No surprises.

### 2.4 Margin philosophy

Standard markup ranges in this sector:

- **Aggregator services** (OpenRouter, LiteLLM cloud, Together.ai): 10-15% markup. Volume play.
- **Full products with UI** (Cursor, Replit AI, Bolt.new, v0): 40-100% markup. UX value.
- **Premium products with unique workflow** (Midjourney, Runway): 200-400% markup. Brand and unique model access.

PIECE Studio sits in the middle. Recommended markup: **40-60%**. This is sustainable, fair to users, and leaves room to compete with direct provider access while accounting for the value of UI integration with Resolve.

### 2.5 Recommended tier structure

This structure works for both the main PIECE platform (AI creators on web) and the Resolve plugin (Resolve users). One billing system, shared tiers.

**Free Trial — 14 days, 200 credits one-time**
- All basic models (Flux, Kling Turbo, basic audio)
- Premium models locked (no Sora 2 Pro 1080p, no Veo 3.1 4K)
- No credit card required
- Goal: let users validate the product works in their environment

**Creator — $19/month — 3000 credits/month**
- Rollover up to 1 month (max 6000 credits accumulated)
- All basic and mid-tier models
- Sora 2 Pro 720p available, 1080p locked
- For AI creators on web and hobby Resolve users
- Stripe/Lemon Squeezy fee: ~$0.85
- Estimated COGS per active user: $7-9
- Estimated net per user per month: $9-11

**Pro — $49/month — 8000 credits/month**
- Rollover up to 3 months (max 24000 credits accumulated)
- All models including Sora 2 Pro 1080p, Veo 3.1 4K
- Top-up packs available
- For serious AI creators and industrial Resolve users
- Stripe/Lemon Squeezy fee: ~$1.72
- Estimated COGS per active user: $20-26
- Estimated net per user per month: $21-27

**Studio — $129/month — 25000 credits/month**
- Rollover up to 3 months (max 75000 credits accumulated)
- All models, priority queue, commercial license
- Multi-seat (up to 3 users)
- Top-up packs at best discount
- For small production teams
- Stripe/Lemon Squeezy fee: ~$4.04
- Estimated COGS per active user: $65-85
- Estimated net per user per month: $40-60

**Top-up packs (Pro and Studio only):**
- 1000 credits — $12 (no discount)
- 3000 credits — $30 (17% discount)
- 10000 credits — $90 (25% discount)

Top-up credits never expire. This is direct profit on stable demand.

### 2.6 Realistic revenue projection

Conservative scenario at month 3-6 post-launch:
- 200 Creator users → $3800 MRR
- 80 Pro users → $3920 MRR
- 15 Studio users → $1935 MRR
- **Total: ~$9655 MRR**

After COGS (~$3500), Stripe fees (~$300), other operational (~$200):
**Net profit: ~$5600/month**

This is a meaningful income for a solo founder and provides runway to invest in growth or hire help.

---

## 3. Provider Strategy

### 3.1 The two categories of providers

Understanding this distinction is critical to avoid building on unstable foundations.

**Category 1 — Serious infrastructure providers**

These are well-funded companies with transparent economics, formal SLAs, B2B-friendly terms, and stable long-term existence. They build on top of GPU infrastructure and sell access at sustainable margins.

- **fal.ai** — Market leader (50% image API share, 44% video), $4.5B valuation, 985 endpoints, custom CUDA engine
- **Replicate** — Older player, broadest open-source catalog, 20-40% more expensive than fal.ai
- **WaveSpeedAI** — Exclusive ByteDance and Alibaba partnerships (Seedream, Seedance, Wan), 600+ models, 99.9% SLA
- **Atlas Cloud** — Vertically integrated GPU infrastructure, 30-50% cheaper than fal.ai claims, 300+ models
- **Runware** — Lowest absolute pricing, $50M Series A, 400000+ models from Hugging Face

**Category 2 — Consumer aggregators with subscriptions**

These are reseller-style services optimized for end consumers. They subsidize subscription pricing with investor money to grow user base. APIs are a side product, not the main business. Their terms are often ambiguous about B2B reselling.

- **SJinn** — Subscription with credits, has Seedance via grey-market access
- **Kie.ai** — Single API key, includes Suno music API which is rare
- **CometAPI** — 500+ models, mainly LLM-focused
- **AIMLAPI** — 400+ models across all media types
- **EvoLink** — OpenAI-compatible gateway over multiple providers

### 3.2 Why category matters

Building production on category 2 is risky because:

1. **Terms of service often prohibit reselling.** Even when not explicitly prohibited, the language is usually ambiguous enough that the provider can ban accounts at will. SJinn's terms specifically use words "personal", "non-transferable", "distribute" — all of which can be interpreted as prohibiting B2B usage.

2. **No SLA.** Category 2 providers explicitly disclaim warranties. If they go down, your service goes down with no compensation.

3. **Subsidized pricing is temporary.** Once growth slows or investor money runs out, prices double or triple. You have no leverage to negotiate.

4. **Smaller companies, higher closure risk.** Most category 2 providers have not raised significant capital. Many will not exist in 2 years.

5. **They depend on category 1 themselves.** If fal.ai raises wholesale rates, every category 2 provider must raise prices.

### 3.3 SJinn case study — temporary tactical advantage

SJinn's unique value proposition is access to ByteDance Seedance 2.0 through grey-market methods (likely automation of Dreamina/CapCut consumer interfaces, or partnership with Chinese resellers). This works because ByteDance has not officially released the international Seedance 2.0 API yet (delayed indefinitely after Hollywood pushback in February-March 2026).

This advantage is temporary. ByteDance is expected to officially launch international Seedance 2.0 API in Q2 2026. When this happens, fal.ai and Atlas Cloud will integrate within days, and SJinn's unique advantage disappears.

**Verdict:** SJinn is a tactical tool for a narrow window, not a strategic foundation.

### 3.4 Recommended provider stack

**Primary backend: fal.ai**
- All Flux, Kling, Veo, Sora, Hailuo models
- ElevenLabs and Stable Audio integrations
- Direct SDK integration via `@fal-ai/client`
- Legally clean B2B usage
- Path to enterprise rates as volume grows

**Secondary backend for ByteDance models: WaveSpeedAI or Atlas Cloud**
- Seedream V4.5/V5 (image)
- Seedance 2.0 when officially integrated
- Wan 2.7 (video editing)
- Alternative path if fal.ai doesn't add ByteDance models quickly

**Tertiary tactical access: SJinn (optional, conditional)**
- Only for Seedance 2.0 access during the gap before official API
- Only if their terms of service explicitly permit reselling (must be confirmed in writing)
- Treated as experimental feature, marketed as "early access, may be unavailable"
- Removed from the system as soon as fal.ai or WaveSpeedAI gains official Seedance access

### 3.5 Provider abstraction architecture

This is the most important technical decision in the entire backend. Implementing it correctly from day one prevents painful migrations later.

```
generation request → Provider interface → routed to specific implementation
```

```javascript
// One interface
interface GenerationProvider {
  generateImage(params): Promise<GenerationResult>
  generateVideo(params): Promise<GenerationResult>
  generateAudio(params): Promise<GenerationResult>
}

// Multiple implementations
class FalProvider implements GenerationProvider { /* ... */ }
class WaveSpeedProvider implements GenerationProvider { /* ... */ }
class AtlasCloudProvider implements GenerationProvider { /* ... */ }
class SJinnProvider implements GenerationProvider { /* ... */ }
```

Model routing configuration is separated from provider implementations:

```javascript
const MODEL_ROUTING = {
  'flux-schnell': { provider: 'fal', model: 'fal-ai/flux/schnell' },
  'flux-pro': { provider: 'fal', model: 'fal-ai/flux/pro' },
  'kling-3.0': { provider: 'fal', model: 'fal-ai/kling-pro-3.0' },
  'veo-3.1': { provider: 'fal', model: 'fal-ai/veo3' },
  'sora-2-pro': { provider: 'fal', model: 'fal-ai/sora-2-pro' },
  'seedream-v4.5': { provider: 'wavespeed', model: 'bytedance/seedream-v4.5' },
  'seedance-2.0': { 
    provider: 'sjinn',  // temporary
    fallback: 'wavespeed',
    note: 'Grey-market access, may be unavailable. Migrate to fal.ai when official API launches.'
  },
};
```

This architecture provides:
- **One-line migration** when providers change
- **Provider failover** when one is down
- **Easy A/B testing** of providers for the same model
- **No coupling** between business logic and provider APIs

### 3.6 Reseller terms verification — mandatory step

Before integrating any category 2 provider, this verification is mandatory:

1. Read their terms of service for keywords: "reseller", "resale", "third party", "B2B", "personal", "non-transferable", "distribute"
2. If language is ambiguous, send a written inquiry to support/Discord/Twitter:
   > "I'm building a SaaS product that will use your API to serve generations to my own paying customers. Is this permitted under your terms? Do you offer commercial/enterprise agreements for this use case?"
3. Save the written response
4. Only proceed if the response is explicit "yes"

Without this verification, building on a category 2 provider is building on legal sand.

---

## 4. Technical Architecture

### 4.1 Credit ledger design

Credit ledger is the core financial system. It must be append-only, atomic, and auditable. Bugs here mean lost money or angry users.

**MongoDB collections in `apps/backend/piece/src/modules/billing/`:**

`credit_balances` — current state, denormalized for fast reads:
```
{
  _id: ObjectId,
  userId: ObjectId (indexed),
  
  subscriptionCredits: Number,
  subscriptionCreditsExpireAt: Date,
  
  topupCredits: Number,  // never expire
  
  bonusCredits: Number,  // referral, support comp
  bonusCreditsExpireAt: Date,
  
  totalCredits: Number,  // computed
  lastUpdatedAt: Date,
  version: Number,  // optimistic locking
}
```

`credit_transactions` — append-only ledger, the source of truth:
```
{
  _id: ObjectId,
  userId: ObjectId (indexed),
  type: 'grant' | 'consume' | 'refund' | 'expire' | 'rollover',
  amount: Number,
  
  reason: 'subscription_renewal' | 'topup_purchase' | 
          'generation_consume' | 'generation_refund' | 
          'monthly_expiry' | 'admin_grant',
  
  generationId: ObjectId,
  providerUsed: 'fal' | 'wavespeed' | 'sjinn' | 'atlas',
  modelUsed: String,
  realCostUSD: Number,
  
  balanceBefore: { subscription, topup, bonus, total },
  balanceAfter: { subscription, topup, bonus, total },
  
  stripeInvoiceId: String,
  stripePaymentIntentId: String,
  
  status: 'pending' | 'confirmed' | 'refunded',
  
  createdAt: Date (indexed),
  metadata: Object,
}
```

**Three credit buckets** (subscription, topup, bonus) allow different expiration rules. When deducting credits, drain in order: subscription first (most likely to expire), bonus second, topup last (never expires).

### 4.2 Atomic credit deduction — race condition handling

The hardest part of the ledger is handling concurrent deductions correctly. Naive implementations cause double-spends.

**Optimistic locking pattern:**

```javascript
async function reserveCredits(userId, amount) {
  const balance = await db.credit_balances.findOne({ userId });
  if (balance.totalCredits < amount) {
    throw new Error('INSUFFICIENT_CREDITS');
  }
  
  const result = await db.credit_balances.updateOne(
    { 
      _id: balance._id, 
      version: balance.version,  // key check
      totalCredits: { $gte: amount }
    },
    {
      $inc: { 
        subscriptionCredits: -Math.min(balance.subscriptionCredits, amount),
        version: 1,
      },
    }
  );
  
  if (result.matchedCount === 0) {
    return reserveCredits(userId, amount);  // race lost, retry
  }
  
  await db.credit_transactions.insertOne({
    userId,
    type: 'consume',
    amount: -amount,
    status: 'pending',
    // ...
  });
}
```

### 4.3 Two-phase deduction for provider failures

When a generation fails after credits are reserved, credits must be refunded automatically.

**Phase 1 — reserve:** create transaction with `status: 'pending'`, deduct from balance.

**Phase 2a — confirm on success:** update transaction to `status: 'confirmed'`.

**Phase 2b — refund on failure:** create new transaction `type: 'refund'`, restore balance.

A cleanup job runs hourly to auto-refund any pending transactions older than 1 hour (covers cases where the backend crashed between phases).

### 4.4 Generation queue via NATS JetStream

PIECE already has NATS JetStream as part of its infrastructure. Use it for the generation queue, not Redis Bull or RabbitMQ.

**Architecture:**
- HTTP handler validates request, reserves credits, publishes job to NATS stream
- Returns `jobId` to client immediately
- Worker process consumes from stream, calls provider, updates DB
- Client polls status via HTTP or receives updates via WebSocket

**Tier-based priority queues:**
- `generation-jobs-studio` — Studio tier, highest priority
- `generation-jobs-pro` — Pro tier, medium priority
- `generation-jobs-creator` — Creator tier, normal priority

Workers process with capacity allocation: Studio reserves 60% capacity, Pro 30%, Creator 10%. During peak hours Creator users may wait several minutes; Studio users always get immediate processing.

**NATS JetStream advantages:**
- Built-in persistence (survives worker crashes)
- Automatic retry with backoff for transient provider failures
- Horizontal scaling — add more workers, they auto-distribute load
- Already in PIECE infrastructure, no new dependency

### 4.5 Concurrency and scale

**Express.js backend** handles 200-500 concurrent users on a single instance. PIECE current architecture supports this with no changes.

**Horizontal scaling** for 1000+ concurrent users: run 2-3 backend instances behind nginx round-robin. Shared state lives in MongoDB and Redis.

**Provider rate limits:**
- fal.ai: ~1000 RPM standard, increases on request for paid accounts
- Replicate: 600 RPM
- Google Gemini: 60 RPM free, 1000 RPM paid

For peak loads beyond a single API key's limit, use multiple keys per provider with round-robin distribution.

**Database read caching:** Redis cache for credit balances with 5-second TTL. Reduces 95% of MongoDB read load while maintaining accuracy.

### 4.6 How operator pays providers — the actual money flow

This is critical to understand operationally because it's not obvious.

**fal.ai model: prepaid balance with auto-recharge.**
1. Operator creates account, links credit card
2. Top up balance to $200 for testing
3. API calls automatically deduct from balance
4. When balance falls below $50, auto-recharge adds $200 from card
5. Operator never deals with "service down due to no funds"

**Replicate model:** identical prepaid + auto-recharge.

**Google Gemini model:** postpaid Google Cloud billing. Monthly invoice for usage.

**ElevenLabs model:** subscription tier ($5, $22, $99/month) with overage at pay-per-use rates.

**For PIECE operator:**
- One account per provider, not per user
- Auto-recharge enabled with daily/weekly spend limits
- Required monitoring dashboard:
  - Current balance per provider
  - Daily/weekly/monthly spend per provider
  - Top 10 models by cost (which models eat budget)
  - Alerts to Telegram/Slack on threshold breaches

**Spending caps prevent disaster scenarios:**
- Daily cap: $500 (alerts at $300, hard stop at $500)
- Per-user daily cap: $50 (prevents abuse from single account)
- Auto-recharge cap: maximum $1000/day from card

Without these caps, a bug or abuse incident could drain thousands of dollars in hours.

### 4.7 Stripe vs Lemon Squeezy

**Stripe** added AI-focused metering and billing in March 2026. New features:
- Meter objects for usage events
- Credit grants for prepaid usage
- Markup percentage applied automatically over raw model costs
- Works with Vercel, OpenRouter, Stripe LLM proxy
- Lower fees: 2.9% + $0.30 per transaction

**Lemon Squeezy** is merchant of record:
- Handles VAT, sales tax in all jurisdictions automatically
- Operator receives clean money after their fee
- Higher fees: 5% + $0.50 per transaction
- Simpler legal setup for international founders
- No need for tax registration in customer countries

**Recommendation:** start with **Lemon Squeezy** for first 6-12 months. The simplicity benefit dramatically outweighs the higher fees when you're a solo founder in Phuket with no time for international tax registration. Migrate to Stripe when MRR exceeds $20k and the fee delta becomes meaningful.

### 4.8 Backend module structure

```
apps/backend/piece/src/modules/billing/
├── controllers/
│   ├── checkout-controller.js       # POST /v1/billing/checkout
│   ├── webhook-controller.js        # POST /v1/billing/webhook
│   ├── balance-controller.js        # GET /v1/billing/balance
│   ├── transactions-controller.js   # GET /v1/billing/transactions
│   └── topup-controller.js          # POST /v1/billing/topup
├── services/
│   ├── payment-service.js           # Wraps Lemon Squeezy / Stripe
│   ├── credit-ledger-service.js     # Atomic credit operations
│   ├── subscription-service.js      # Subscription lifecycle
│   ├── pricing-service.js           # Tier and credit pricing logic
│   ├── rollover-service.js          # Monthly rollover job
│   └── provider-cost-service.js     # Real cost tracking per generation
├── models/
│   ├── credit-balance.js
│   ├── credit-transaction.js
│   └── subscription-record.js
├── jobs/
│   ├── monthly-rollover-job.js      # Cron: rollover expired credits
│   ├── pending-cleanup-job.js       # Cron: cleanup stale pending
│   └── provider-balance-monitor.js  # Cron: alert on low provider balance
├── routes.js
└── config.js
```

Estimated total: 1500-2000 lines of code. Critical module — every operation must be tested, especially race conditions and refund flows.

---

## 5. Architecture for the Plugin

### 5.1 Plugin role in the architecture

The plugin is a thin client of PIECE backend. It does not have its own billing logic. It calls PIECE APIs for everything related to money.

**What lives in the plugin:**
- Resolve API integration (WorkflowIntegration.node bindings)
- UI for sign-in, balance display, generation panels
- Local file management for downloaded media
- Provider routing knowledge (which model goes to which provider) — but actual provider calls go through PIECE backend

**What lives in PIECE backend:**
- Auth, license check
- Credit ledger
- Generation queue
- Provider integrations
- Stripe/Lemon Squeezy webhooks

**Why not call providers directly from the plugin:**
- API keys would be exposed to user machines (security)
- Rate limit management requires central coordination
- Credit deduction must be server-side authoritative
- Generation history must be centralized for analytics

### 5.2 Plugin generation flow

1. User clicks "Generate" in plugin
2. Plugin sends `POST /v1/generations` to PIECE backend with model ID, prompt, parameters
3. Backend checks license, reserves credits, creates pending transaction
4. Backend publishes job to NATS queue, returns `jobId` to plugin
5. Plugin shows "generating" state, polls or subscribes to status
6. Worker picks up job, calls fal.ai/WaveSpeed/whatever provider
7. Worker downloads result to temp storage
8. Worker confirms transaction, updates job status to `complete`
9. Plugin receives status, downloads file from PIECE temp URL
10. Plugin imports file into Resolve via WorkflowIntegration.node
11. Plugin clears temp URL when done

### 5.3 Plugin-specific architecture decisions from earlier sessions

These were established in previous planning sessions and remain valid:

- Plugin lives in `apps/resolve-plugin/` inside PIECE monorepo
- Main process: ESM JavaScript (matches PIECE backend convention)
- Renderer: TypeScript + React 19 + Tailwind v4 (matches PIECE frontend)
- Uses `@piece/logger`, `@piece/config`, `@piece/encryption`, `@piece/domain-types`
- Authentication via desktop OAuth flow with custom URL scheme `piece-studio://`
- Token storage encrypted with `@piece/encryption` in OS-specific app data directory
- Floating bubble UI as primary interface, expandable to full panel
- Manifest ID: `app.piece.studio`
- Per-user installation in `~/Library/Application Support/...` (no sudo)
- All code follows PIECE iron-laws (TDD, no console.log, no process.env, etc.)

---

## 6. Resolve API Capabilities — Reference for Future Versions

This section documents what is technically possible through `WorkflowIntegration.node` for planning future plugin features. Most of this is for v2.0 and beyond, not v1.0.

### 6.1 Confirmed working

- `MediaPool.ImportMedia([filePath])` — import files
- `MediaPool.AppendToTimeline([clipInfo])` — insert on timeline
- `Project.ExportCurrentFrameAsStill(filePath)` — capture current frame
- `Resolve.GetProjectManager().GetCurrentProject().GetCurrentTimeline()` — read state

### 6.2 Known broken in JS API

- `Timeline.GrabStill()` — `ParseProxyObject` error, use `ExportCurrentFrameAsStill` instead
- `Timeline.GetStartTimecode()` — invalid arguments error, calculate manually
- `Project.GetGallery()` methods — race conditions, avoid

### 6.3 Untested but documented

**Project and timeline management:**
- `ProjectManager.CreateProject(name)` — programmatic project creation
- `MediaPool.CreateEmptyTimeline(name)` — create new timeline
- `MediaPool.CreateTimelineFromClips(name, clips)` — assemble from clips
- `MediaPool.AddSubFolder(parent, name)` — folder organization
- `MediaPool.MoveClips(clips, folder)` — bulk reorganization

**Timeline introspection:**
- `Timeline.GetItemListInTrack(type, index)` — read clips on track
- `Timeline.GetTrackCount(type)` — track count
- `Timeline.GetCurrentTimecode()` / `SetCurrentTimecode(tc)` — playhead control
- `Timeline.GetSetting('timelineFrameRate')` — frame rate
- `TimelineItem.GetStart()` / `GetEnd()` / `GetDuration()` — clip bounds
- `TimelineItem.GetMediaPoolItem()` — back-reference to source
- `TimelineItem.GetProperty(name)` / `SetProperty(name, value)` — transforms

**Markers — critical for PIECE bridge:**
- `Timeline.AddMarker(frameId, color, name, note, duration, customData)`
- `Timeline.GetMarkers()` — read all markers
- `Timeline.UpdateMarkerCustomData(frameId, customData)`
- `TimelineItem.AddMarker(...)` — markers on individual clips
- `customData` accepts arbitrary JSON string — perfect for storing `pieceShotId`, `pieceProjectId`, sync metadata

**Render API:**
- `Project.LoadRenderPreset(name)` — load preset
- `Project.SetRenderSettings(dict)` — configure render
- `Project.AddRenderJob()` — queue render
- `Project.StartRendering(jobIds)` — execute
- `Project.GetRenderJobStatus(jobId)` — poll progress
- `Project.DeleteRenderJob(jobId)` — cancel

**Replace clip — the main moat for PIECE:**
- `MediaPoolItem.ReplaceClip(filePath)` — replace source file while preserving all timeline items, color, effects, masks

**Color page:**
- `TimelineItem.GetCurrentVersion()` / `SetCurrentVersion(name)` — color version switching
- `TimelineItem.LoadGradeFromFile(filePath)` — apply grades
- `TimelineItem.SaveGradeToFile(filePath)` — export grades

**Audio (Fairlight):**
- Audio track operations identical to video tracks
- `TimelineItem.GetProperty('Volume')` / `SetProperty('Volume', dB)`
- `Timeline.CreateSubtitlesFromAudio()` — neural engine speech recognition
- `Timeline.ExportTrackAsSRT()` — subtitle export

**Proxy media:**
- `MediaPoolItem.LinkProxyMedia(proxyPath)` — attach proxy
- `MediaPoolItem.UnlinkProxyMedia()` — detach

### 6.4 Future feature ideas (v2.0+)

These are deferred but documented for future planning:

1. **Auto-generated timeline from PIECE rundown** — generate full timeline structure from PIECE project metadata
2. **Smart marker import from PIECE comments** — sync producer comments to timeline markers
3. **AI Replace without losing grade** — regenerate AI content while preserving color/effects
4. **Proxy upload to PIECE** — render fragments and upload for cloud review
5. **Bidirectional shot navigation** — click in PIECE → jump in Resolve
6. **Bulk asset organization** — auto-organize Media Pool by PIECE structure
7. **Smart placeholder insertion** — fill empty slots with AI-generated previews
8. **Color version per AI generation** — every regeneration as separate version
9. **Render queue automation** — PIECE-driven batch rendering
10. **Live shoot monitor** — watched folder integration for on-set workflows
11. **Live screenplay sync via WebSocket** — real-time collaboration with PIECE web users
12. **Smart take selection via AI vision** — analyze and rank takes automatically
13. **Auto-assemble first cut** — generate rough edit from script and footage
14. **Audio-driven editing** — match dialogue to script via subtitle generation

---

## 7. Open Questions and Decisions Needed

These need explicit decisions before implementation can begin:

**Decision 1: Billing in MVP scope?**
Adding billing to PIECE MVP pushes launch from 2026-05-02 by 2-3 weeks. Trade-off: defer Board feature to post-launch update.

**Decision 2: Lemon Squeezy or Stripe?**
Recommendation: Lemon Squeezy for first 6-12 months, Stripe after MRR > $20k. Need explicit confirmation.

**Decision 3: Tier pricing — final numbers?**
Proposed: Creator $19, Pro $49, Studio $129. May need adjustment after market research with target users.

**Decision 4: Provider strategy — fal.ai only or hybrid?**
Recommendation: fal.ai as primary, WaveSpeedAI for ByteDance models, SJinn only as conditional grey-market access for Seedance until official API.

**Decision 5: Reseller terms verification for SJinn?**
Must contact SJinn support and get written confirmation that reselling is allowed under their terms before any production integration. This is a hard prerequisite.

**Decision 6: Seedance 2.0 priority?**
Is Seedance access critical for plugin launch (must-have), nice-to-have, or can wait for official API? Determines whether grey-market route is needed.

**Decision 7: Plugin launch timing relative to PIECE main launch?**
Three options:
- Plugin first, PIECE main later
- PIECE main first, plugin later
- Both simultaneously

Recommendation: PIECE main MVP first (with billing), then plugin as second commercial client 2-3 weeks later, reusing all billing infrastructure.

---

## 8. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Race conditions in credit ledger cause double-spends | High | Optimistic locking + comprehensive concurrency tests |
| Provider failure leaves credits in limbo | High | Two-phase deduction + cleanup job for stale pending |
| Provider cost spikes drain operator funds | High | Daily spend caps, per-user daily caps, monitoring alerts |
| SJinn closes account for B2B usage | Medium | Provider abstraction allows one-line migration to fal.ai/WaveSpeed |
| ByteDance enforces grey-market shutdown | Medium | Treat Seedance as experimental, market it as such |
| Lemon Squeezy/Stripe webhook delivery failures | Medium | Idempotent handlers, dead letter queues, manual reconciliation tools |
| Concurrent users overwhelm single backend instance | Medium | Horizontal scaling planned, NATS queue smooths peaks |
| Pricing too high → no conversions | Medium | Free trial 14 days for validation, adjust tiers based on early data |
| Pricing too low → operator loses money on heavy users | High | Per-user daily spend caps, usage analytics, ability to increase prices for new users |
| Single provider lock-in if abstraction is skipped | Critical | Provider abstraction is mandatory from day one |
| Burnout from scope expansion | Critical | Hard limit 12 hours/day, one rest day per week, mandatory sleep |

---

## 9. References and Sources

This memo synthesizes information from:

- fal.ai pricing pages and API documentation (April 2026)
- ByteDance Seedance 2.0 status reports (multiple sources, March-April 2026)
- Stripe metered billing documentation (March 2026 update for AI usage billing)
- Lemon Squeezy merchant of record documentation
- WaveSpeedAI vs fal.ai comparison reports
- Atlas Cloud blog comparisons (2026)
- SJinn pricing page, terms of service, API documentation
- PIECE platform architecture (CLAUDE.md, .claude/rules/, EISERN-MASTER-PLAN.md)
- PIECE product-vision.md (April 2026)

All cost figures are accurate as of April 2026 and should be re-verified before implementation starts, as AI provider pricing changes frequently.

---

## 10. Notes for Implementation Team

When this memo is converted into an implementation plan:

1. **Read existing PIECE code first** before writing new modules. Match patterns from existing modules like `auth/`, `teams/`.

2. **Use existing @piece/* packages** — never reinvent. Logger, config, encryption, domain-types, validation, multitenancy all exist.

3. **TDD is non-negotiable** for billing code. Every credit operation must have a test, especially race condition tests.

4. **Run lint+test+build at every phase gate.** Trust no incremental progress without verification.

5. **Commit per phase, not per file.** Conventional commits, no auto-push.

6. **All file names kebab-case, classes PascalCase, English only in code.**

7. **The provider abstraction layer is the most important architectural decision.** Get it right on day one.

8. **Reseller terms verification is a hard prerequisite for SJinn integration.** No code touches SJinn until written permission is obtained.

9. **Cost monitoring dashboard must exist before launch.** Without spend caps and alerts, a bug or abuse can drain provider balances in hours.

10. **Re-read Iron Laws before each commit.** Especially: no quick fixes, root cause investigation, no completion claims without verification.

---

**End of memo.**

This document should be placed in `docs/` or `.claude/plans/` in the PIECE repository as a reference for billing and provider strategy decisions. It should be updated as decisions are made and reality diverges from assumptions.
