# Domain Types

## Overview

Shared frozen enums and factory functions for the KOZA cinematic domain. Thin package -- definitions only, no logic.

Location: `packages/domain-types/src/`

## Data Flow

```
Screenplay (text)  →  Rundown (structure)  →  Timeline (cache)
     ↓                     ↓                      ↓
   Bible (refs)      Production (visuals)    Storyboard (shots)
                           ↓
                    Canvas/Pipeline (AI generation)
```

## Screenplay Types (`screenplay.js`)

### Element Types

```javascript
SCENE_HEADING, ACTION, CHARACTER, PARENTHETICAL, DIALOGUE, TRANSITION, SHOT
```

### Duration Sources

```javascript
AUTO, MANUAL, MEDIA
```

### Element Flow (default transitions)

| After | Next element |
|-------|-------------|
| Scene heading | Action |
| Action | Action |
| Character | Dialogue |
| Parenthetical | Dialogue |
| Dialogue | Character |
| Transition | Action |
| Shot | Action |

### Factories

- `generateBlockId()` → `blk_{timestamp}_{counter}`
- `createScreenplayElement(partial)` → element with defaults

## Cinematic Types (`cinematic.js`)

### Shot Sizes

```javascript
ECU (Extreme Close Up), CU, MCU, MS, MLS, LS, WS, EWS (Extreme Wide Shot)
```

### Camera Motions

```javascript
STATIC, PAN_LEFT, PAN_RIGHT, TILT_UP, TILT_DOWN, DOLLY_IN, DOLLY_OUT,
TRACKING, CRANE_UP, CRANE_DOWN, HANDHELD, STEADICAM
```

### Shot Keyframe Roles

```javascript
KEY, SECONDARY, INSERT
```

### Shot Relations

```javascript
MATCH_CUT, CUT_ON_ACTION, INSERT, REACTION, REVERSE, ESTABLISH, PARALLEL
```

### Relation Intents

```javascript
FOCUS_SHIFT, REACTION, ACTION_CONTINUATION, GEOGRAPHY, TENSION, REVEAL
```

## Rundown Types (`rundown.js`)

### Entry Types

```javascript
ESTABLISHING, ACTION, DIALOGUE, TRANSITION, HEADING
```

### Factories

- `makeRundownEntryId()` → `rde_{timestamp}_{counter}`
- `createRundownEntry(partial)` → entry with visual, modifier, shot, generation fields

## Bible Types (`bible.js`)

### Interior/Exterior

```javascript
INT, EXT, INT/EXT
```

### Factories

- `createCharacterEntry(partial)` → character with appearance, wardrobe, palette
- `createLocationEntry(partial)` → location with architecture, lighting, weather
- `createPropEntry(partial)` → prop with appearance

## Production Types (`production.js`)

### Change Origins

```javascript
SCREENPLAY, STORYBOARD, TIMELINE, VOICE, CANVAS, SYSTEM, REMOTE
```

### Modifier Types

```javascript
DEFAULT, AI_AVATAR, EFFECT, B_ROLL, TITLE_CARD, CANVAS
```

### Visual Types

```javascript
IMAGE, VIDEO
```

### Factories

- `createProductionVisual(partial)` → visual with generation history
- `createBlockModifier(partial)` → modifier with template + params

## Generation Types (`generation.js`)

### Categories

```javascript
IMAGE, VIDEO, LIPSYNC, MOTION
```

### Providers

```javascript
OPENAI, GOOGLE, SJINN
```

### Statuses

```javascript
QUEUED, PROCESSING, DONE, FAILED
```

### Factories

- `createGenerationRequest(partial)` → request with prompt, references, aspect ratio
- `createGenerationResult(partial)` → result with url/blob, content type

## Canvas Types (`canvas.js`)

### Port Data Types

```javascript
TEXT, IMAGE, VIDEO, AUDIO, NUMBER, STYLE, BIBLE, ANY
```

### Port Colors

| Type | Color |
|------|-------|
| text | #8B5CF6 |
| image | #10B981 |
| video | #EF4444 |
| audio | #F59E0B |
| number | #3B82F6 |
| style | #A855F7 |
| bible | #D97706 |
| any | #6B7280 |

### Node Categories

```javascript
SOURCE, REFERENCE, PROCESSING, GENERATION, OUTPUT, HELPER
```

## Collaboration Types (`collaboration.js`)

### Operation Types

```javascript
BLOCK_CREATE, BLOCK_UPDATE, BLOCK_DELETE, BLOCK_CHANGE_TYPE, BLOCK_REORDER, BLOCK_UPDATE_META,
SHOT_CREATE, SHOT_UPDATE, SHOT_DELETE, SHOT_REORDER,
SETTINGS_SET
```

### Client Message Types

```javascript
AUTH, JOIN, LEAVE, OP, LOCK, UNLOCK, PRESENCE
```

### Server Message Types

```javascript
AUTH_OK, AUTH_ERROR, SNAPSHOT, OP, OP_ACK, OP_REJECT,
LOCK_OK, LOCK_DENIED, LOCK_ACQUIRED, LOCK_RELEASED,
PRESENCE_UPDATE, USER_JOINED, USER_LEFT, ERROR
```

## Cross-File Relationships

| Source | Target | Relationship |
|--------|--------|-------------|
| Screenplay elements | Rundown entries | Text feeds into structure |
| Screenplay SHOT | Cinematic shot sizes/motions | Shot metadata |
| Rundown entries | Production visuals | Visual attachment per entry |
| Production visuals | Generation statuses | Generation lifecycle tracking |
| Generation categories | Visual types | IMAGE/VIDEO correspondence |
| Canvas port types | Bible types | BIBLE port connects to bible data |
| Collaboration ops | Screenplay/shot mutations | BLOCK_*/SHOT_* operations |
| Change origins | All domains | Tracks where mutation originated |

## Conventions

- All enums use `Object.freeze()` for immutability
- Factory functions accept partial objects and fill defaults
- IDs use `{prefix}_{timestamp}_{counter}` format (`blk_`, `rde_`)
- All values are string constants (no numeric enums)
