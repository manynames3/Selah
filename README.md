# SELAH

Daily devotional songwriting site: one song, one scripture, one archive.

The app is intentionally simple:
- one main frontend file: `index.html`
- Netlify serverless functions for archive reads and R2 media operations
- one small `package.json` for server-side function dependencies
- Netlify config for cache behavior: `netlify.toml`

The current UI uses a vinyl-player metaphor with a turntable, animated tonearm, waveform scrubbing, lyrics modal, archive list, and password-gated admin upload flow.

## Tech Stack

| Layer | Tooling |
| --- | --- |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Client data/auth/storage access | `@supabase/supabase-js` via CDN |
| MP3 artwork extraction | `jsmediatags` via CDN |
| Media object storage | Cloudflare R2 for MP3 uploads |
| Data store | Supabase Postgres |
| Artwork storage | Supabase Storage |
| Hosting | Netlify |
| Serverless proxy | Netlify Functions |
| Function dependencies | AWS SDK v3 S3 client + presigner |
| Typography | Google Fonts (`Libre Baskerville`, `Bebas Neue`, `Nunito`) |

### Current vs Recommended Stack

Current production shape:
- Supabase stores metadata in Postgres
- Cloudflare R2 stores MP3 files
- Supabase Storage stores artwork
- Netlify hosts the site plus archive/R2 helper functions

Recommended next shape:
- keep Supabase for metadata and CRUD
- keep MP3 delivery on Cloudflare R2
- optionally move artwork to R2 later as well

That pivot is about storage strategy, not a rewrite of the application model.

## Project Structure

```text
.
├── index.html
├── README.md
├── package.json
├── netlify.toml
└── netlify/
    ├── functions/
    │   ├── _r2.js
    │   ├── devotionals.js
    │   ├── r2-delete-object.js
    │   └── r2-presign-upload.js
```

## How It Works

### Frontend

`index.html` contains:
- all page markup
- all styling
- all playback logic
- Supabase reads/writes for devotional metadata
- direct-to-R2 signed upload flow for MP3 files
- Supabase artwork upload flow
- waveform generation and seeking
- tonearm animation and playback-state sync

This repo deliberately avoids a framework or build step. That keeps deployment friction low and makes Netlify deploys straightforward.

### Data Model

The app reads from a single `devotionals` table:

```sql
create table devotionals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  scripture   text,
  entry_date  date not null,
  lyrics      text,
  audio_url   text,
  art_url     text,
  created_at  timestamptz default now()
);
```

Recommended policies used by this project:

```sql
alter table devotionals enable row level security;

create policy "Public read" on devotionals
for select using (true);

create policy "Anon insert" on devotionals
for insert with check (true);

create policy "Anon delete" on devotionals
for delete using (true);
```

Storage buckets:
- `devotional-audio`
- `devotional-art`

### Archive Loading

The archive now prefers a production-safe path:

1. Netlify function `/.netlify/functions/devotionals`
2. direct Supabase REST read
3. direct Supabase client query

That fallback chain exists because browser-only first-load archive loading was intermittently hanging in the deployed flow. The Netlify function removes that dependency on a fragile browser-to-Supabase path.

### Storage Pivot: Supabase -> Cloudflare R2 for Media

The app now uses a hybrid storage model:

- Supabase Postgres remains the source of truth for song metadata
- Supabase still handles the record-level CRUD workflow
- Cloudflare R2 is the storage backend for MP3 files
- artwork remains in Supabase Storage for now

The implemented flow is:

1. frontend asks Netlify for a presigned R2 upload URL
2. frontend uploads the MP3 directly to R2
3. frontend saves the resulting public R2 URL into `audio_url`
4. frontend continues to write devotional metadata to Supabase
5. delete requests remove the Supabase record and then clean up the R2 object

That keeps the schema and most of the UI logic intact while moving the heaviest asset class off Supabase storage quotas.

## Setup

### 1. Configure Supabase

Create a Supabase project and set up:
- the `devotionals` table
- the public read / anon insert / anon delete policies
- two public storage buckets:
  - `devotional-audio`
  - `devotional-art`

### 2. Configure the app

Open `index.html` and update the config block:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';
const ADMIN_PASSWORD = 'your-password';
```

### 3. Configure Netlify environment variables for R2

Set these in Netlify:

```text
CF_R2_ACCOUNT_ID
CF_R2_ACCESS_KEY_ID
CF_R2_SECRET_ACCESS_KEY
CF_R2_AUDIO_BUCKET
CF_R2_AUDIO_PUBLIC_BASE_URL
CF_R2_AUDIO_KEY_PREFIX
```

Notes:
- `CF_R2_AUDIO_PUBLIC_BASE_URL` should be your public R2 bucket URL or custom domain
- `CF_R2_AUDIO_KEY_PREFIX` is optional, for example `audio`
- the R2 bucket must be publicly readable for direct MP3 playback by URL
- configure R2 bucket CORS to allow `PUT` from your Netlify site origin, or browser uploads to presigned URLs will fail

### 4. Configure the Netlify functions

These files now participate in the storage flow:

```text
netlify/functions/_r2.js
netlify/functions/devotionals.js
netlify/functions/r2-presign-upload.js
netlify/functions/r2-delete-object.js
```

### 5. Deploy

#### Netlify from GitHub

1. Push the repo to GitHub
2. Create a Netlify site from that repository
3. Netlify will deploy `index.html` as the main site
4. Netlify will install `package.json` dependencies for the functions
5. Netlify will expose:
   - `/.netlify/functions/devotionals`
   - `/.netlify/functions/r2-presign-upload`
   - `/.netlify/functions/r2-delete-object`

#### Manual note

If you open `index.html` directly with `file://`, the Netlify function paths do not exist. The page can still render locally, but the production archive-loading and R2-upload paths are meant for the deployed Netlify site.

## Thought Process

The project follows a few practical constraints:

### 1. Keep the app editable in one place

The main UX and business logic live in one file so changes can be made quickly without a bundler, framework conventions, or build tooling overhead.

### 2. Use animation where it reinforces playback state

The turntable UI is decorative, but the important motion is functional:
- the disc spinning means playback is active
- the waveform shows progress and allows seeking
- the tonearm position reflects song progress

That means animation is tied to actual audio state instead of just CSS loops.

### 3. Preserve a static-site deployment model

Even after the archive-loading bug, the solution stayed within the existing hosting model by adding a small Netlify function instead of moving the whole app to a framework or custom backend.

### 4. Separate metadata from media when the workload demands it

Supabase is a good fit for structured devotional records and simple CRUD. Large audio files create a different kind of pressure:
- storage quotas get hit sooner
- media streaming/download usage grows differently than metadata queries
- audio is the part of the app most likely to scale in total bytes

That is why the recommended pivot is not "replace Supabase", but "keep Supabase where it is strong and move bulk media to object storage built for that job."

### 5. Minimize migration risk

The R2 pivot is intentionally incremental:
- do not replace the database
- do not rewrite archive reads
- do not rebuild the frontend around a new framework
- only swap the upload/delete path for MP3 objects

That keeps the blast radius small and makes the migration reversible if needed.

## Why Cloudflare R2

R2 is the recommended media-storage target for this project because:

- the project uploads relatively large MP3 files
- free-tier storage headroom is better suited to a growing song archive
- egress-free delivery is a better match for downloadable/streamable audio
- it lets the app keep its current Supabase-backed metadata model

In other words: R2 is the better place for binary media, while Supabase remains the better place for the devotional record itself.

## Media Upload Flow

Current MP3 upload path:

1. user selects an audio file
2. frontend requests a presigned upload URL from Netlify
3. frontend uploads the MP3 directly to Cloudflare R2
4. frontend stores the final public MP3 URL in Supabase

Current artwork path:

1. artwork is extracted from the MP3 client-side with `jsmediatags`
2. extracted artwork is uploaded to Supabase Storage
3. artwork URL is stored in Supabase

This split keeps the heavier media on R2 while avoiding an unnecessary second migration for artwork.

## Troubleshooting Notes

### Archive stuck on "Loading songs..."

This was one of the main debugging issues.

Root causes and fixes:
- browser-side archive loading was unreliable on initial load in the deployed flow
- a visualizer init crash could prevent later setup code from running
- direct client and REST reads needed a more resilient fallback chain

What changed:
- added `netlify/functions/devotionals.js` as a same-origin archive proxy
- made archive loading use function -> REST -> client fallback
- guarded the visualizer canvas access so a missing/unsupported context does not break the rest of app initialization

### MP3 storage limits on Supabase

Another operational issue was storage pressure from 5 MB-ish MP3 uploads. That is what drove the R2 pivot:
- MP3 files are the largest asset class in the app
- metadata storage growth is minor by comparison
- moving audio off Supabase reduces quota pressure without changing the query model

### Tonearm moving the wrong direction

The original tonearm motion rotated away from the record instead of onto it. That was corrected first, then replaced with a progress-driven tonearm model.

### Tonearm realism

The player now uses:
- a longer tonearm
- progress-based inward tracking across the song duration
- pause/resume behavior driven by actual audio state
- reset behavior on track change and restart

Current sweep:
- start angle: `9deg`
- end angle: `36deg`

Interpolation is linear from `audio.currentTime / audio.duration`.

### Waveform scrubbing

Waveform seeking was tightened so the scrubber uses the rendered waveform bounds and updates progress immediately after a seek, rather than waiting for the next audio time event.

### Why pivot storage at all?

The main reason is not that Supabase is the wrong tool overall. The issue is that this specific app mixes:
- small structured devotional records
- comparatively large audio assets

Those two concerns age differently. Metadata is cheap and query-oriented. Audio is bandwidth and storage heavy. Splitting them is the more durable architecture once the archive starts growing.

## Recent Updates Made

Recent work on this repo included:

- fixed first-load archive rendering so songs appear without visiting the admin screen
- added a Netlify function proxy for archive reads
- fixed the tonearm moving in the wrong direction
- replaced fixed tonearm states with progress-based inward tracking
- narrowed tonearm sweep to a more realistic `9deg -> 36deg`
- lengthened the tonearm so the stylus reaches further across the record
- fixed waveform scrubbing behavior
- added volume control with mute/unmute and live percentage readout
- improved header and archive UI hierarchy
- changed the brand lockup text to `SELAH`
- removed the top-right tagline from the header
- removed the `WAVEFORM SEEK` label while keeping the helper text
- changed the left transport control to `-15 REWIND`
- tightened spacing between song date, title, and key/scripture in both the hero player and archive list
- implemented direct-to-R2 signed MP3 uploads through Netlify functions
- implemented R2 cleanup for MP3 deletes
- documented the storage pivot and the hybrid Supabase + R2 architecture

## Current UX Features

- vinyl-style player with animated disc
- progress-driven tonearm tracking
- waveform seek
- auto-advance to next song
- playback speed controls
- loop toggle
- lyrics modal
- volume slider + mute toggle
- archive summary and selected-song context
- admin gate for upload flow
- delete controls visible only in admin mode
- direct-to-R2 audio upload path for new songs

## Operational Notes

- `netlify.toml` disables aggressive HTML caching so archive and UI updates show up faster after deploy
- the admin password is stored client-side in `index.html`, which is acceptable only for a lightweight personal project, not for a hardened production admin system
- the Netlify archive function currently contains Supabase values inline; if this grows beyond a personal project, move those to Netlify environment variables
- the MP3 path now depends on R2-related Netlify environment variables being set correctly
- if the R2 signing flow is unavailable, the frontend falls back to Supabase audio storage rather than blocking uploads entirely

## If You Want To Extend It

Practical next steps:
- keep `audio_url` in Supabase as the pointer to the stored MP3
- decide whether artwork should remain in Supabase or move to R2 after audio is stable
- move Supabase credentials for the function into Netlify environment variables
- replace client-side admin password gating with a real auth flow
- split `index.html` into smaller modules once change velocity makes single-file editing too costly
- add tests around archive loading and playback-state sync if the project grows

## License

Personal project / portfolio-style usage unless you choose otherwise.
