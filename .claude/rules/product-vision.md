# Product Vision

## What is Piece

Piece is an AI-powered cinematic production platform — an operating system for filmmaking. It unifies the entire pipeline from script to screen in a single continuous workspace, replacing the fragmented 5-10 tool workflow (Final Draft → Storyboarder → spreadsheets → camera → DaVinci Resolve → After Effects → social media).

The core differentiator: **context**. Unlike standalone AI generators (Runway, Midjourney) that produce isolated outputs, Piece generates visuals that understand the story — characters, locations, mood, continuity — because everything lives in one pipeline.

## The Module Concept

The **module** is the atomic unit of the Piece timeline. Each module:

- Displays visual content (image or video)
- Knows **how** it was created (which AI provider, parameters, prompts, references)
- Stores **full generation history** — any version can be revisited, modified, regenerated
- Is **provider-agnostic** — the visual result matters, not which AI made it
- Eventually accepts **real footage** that replaces AI previz while preserving history

A module is not a static file — it is a living object that remembers its entire creative lineage from the script line that inspired it to the final rendered frame.

## Unified Pipeline

The key architectural insight: screenplay (text), rundown (structure), and timeline (with audio) are not three separate tools — they are one continuous whole.

```
Screenplay  →  defines WHAT happens (text, dialogue, action)
     ↓
Rundown     →  defines HOW it looks (shots, modules, structure)
     ↓
Timeline    →  defines WHEN it plays (timing, audio sync, playback)
     ↓
Bible       →  provides WHO and WHERE (characters, locations, props — shared context)
```

Changes flow bidirectionally. Editing the screenplay updates the rundown and timeline. Changing a shot on the timeline reflects back to the structure. The Bible provides consistent character/location references across all layers.

## Target Audiences

### Primary (MVP): AI Creators

YouTubers, social media creators, advertisers, content studios. They need to produce long-form AI video content (not just single images). No physical production involved — 100% AI generation. They are already paying for Runway, Midjourney, Sora — but have no tool for organizing AI content into coherent narratives.

### Secondary (3-6 months): Indie Production

Short film directors, music video creators, web series producers. They use AI for previsualization, then shoot partial real footage. They need production planning (shot lists, schedules) alongside AI previz. Hybrid workflow: AI + camera.

### Tertiary (1+ year): Classic Production Studios

Full production houses and studios. AI as an assistant tool, not replacement. Previsualization, storyboarding, reference generation. Eventually: real footage replaces AI previz in modules, proxy workflow with timecodes, on-set mobile monitoring.

## MVP Scope

**Deadline:** 3 weeks (~2026-05-02)
**Target audience:** AI creators
**Core principle:** Glue existing code into one working end-to-end flow. The code is ~80% built but pieces are not connected.

### MVP Deliverables

1. **End-to-end pipeline**: User writes/pastes screenplay → system breaks it down into scenes/shots → AI generates visuals per shot → result plays on timeline with audio. One unbroken flow.

2. **Board**: Creative workspace for ideation. ReactFlow canvas where users brainstorm with images, text, references, scenes before committing to the screenplay. Already partially built at `/board` with 13 node types.

3. **Showcase landing page**: Replace current gradient placeholders with real AI-generated film stills and clips created on the platform. Add AI cinema news section. This is the primary lead magnet — visitors see impressive results and want to create their own.

### What is NOT in MVP

- Proxy workflow with timecodes (large file handling)
- Real footage upload/replacement
- Multilingual collaboration
- Production scheduling
- Mobile app
- Export to social platforms
- Community features
- E2E test suite

## Post-MVP Roadmap

Listed in approximate priority order:

| Feature | Description | Timeframe |
|---------|-------------|-----------|
| Proxy workflow | Handle large video files with timecodes, proxy editing | Months |
| Multilingual collab | Each user sees screenplay/UI in their language, system auto-translates between collaborators | Months |
| Production scheduling | Crew management, shot tracking, on-set mobile app | Months |
| Real footage pipeline | Upload camera footage with timecodes, replace AI previz in modules, near-realtime monitoring | Months |
| Auto post-production | Automatic music, titles, effects generation | Weeks-months |
| Distribution | Export to YouTube, social media, Reels with format adaptation | Weeks |
| Community | Connect anyone to a production, public project showcase | Months |

## Current State (as of 2026-04-11)

### Backend — Strong

12 of 15 modules COMPLETE with tests. 96 endpoints. All real implementations, no stubs. Auth fully implemented (JWT RS256, refresh rotation, magic links, lockout, sessions). WebSocket collaboration working (locks, presence, operations).

### Frontend — Strong

All pages except `/export` have real UI. 23 Zustand stores, all functional. Full Slate screenplay editor (~1900 lines). ReactFlow board with 13 node types. Auth flow complete.

### Pipeline — Partially Connected

Individual pieces work but are not glued into one continuous flow. Screenplay editor works. Scene parser works. Rundown builder works. AI generation works. Timeline works. But a user cannot go from "paste screenplay" to "watch generated video on timeline" without manual steps and context switching.

### Landing — Needs Work

GallerySection has structural shell but all 9 items are gradient placeholders with fake data. No news/blog section. No CMS. Footer links are dead (`#`). Hero and features sections are complete.

### Infrastructure — Healthy

Staging deployed on Hetzner VPS. Monitoring stack (Prometheus/Grafana/Loki) operational. CI/CD for staging via GitHub Actions. Production deploy workflow not yet created (not needed until release).
