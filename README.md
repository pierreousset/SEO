# SEO Dashboard

AI-first rank tracking + weekly actionable briefs. Indie alternative to Semrush.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Neon Postgres** + **Drizzle ORM**
- **Better Auth** (OTP email, via **Resend**)
- **Google OAuth** (separate flow, for Google Search Console API access)
- **Inngest** (daily SERP fetch + weekly brief cron)
- **DataForSEO** (SERP Standard API, ~$0.0006/query)
- **Anthropic Claude Sonnet** (brief generation)
- **shadcn/ui** + **Tailwind 4** + **Geist Sans/Mono**

Design system: see `DESIGN.md` at the repo root (above this folder).

## Setup (first time)

```bash
# 1. Install
bun install

# 2. Copy env template and fill in
cp .env.example .env.local
# Edit .env.local with your Neon URL, Resend key, Google OAuth creds,
# DataForSEO login/password, Anthropic key.
# Generate secrets:
#   openssl rand -base64 32   # -> BETTER_AUTH_SECRET
#   openssl rand -hex 32      # -> GSC_TOKEN_ENCRYPTION_KEY

# 3. Push schema to Neon
bun db:push

# 4. Run dev server
bun dev
```

Visit http://localhost:3100.

## Inngest dev

In a second terminal:

```bash
bunx inngest-cli@latest dev
```

This gives you the Inngest dashboard at http://localhost:8288 where you can see
scheduled jobs and trigger them manually.

## DB commands

| Command | What it does |
|---------|--------------|
| `bun db:generate` | Create a migration file from schema changes |
| `bun db:push` | Push schema directly (dev only, no migration) |
| `bun db:migrate` | Apply generated migrations |
| `bun db:studio` | Open Drizzle Studio GUI |

## Architecture

```
app/
  api/
    auth/[...all]/      Better Auth OTP routes
    google/callback/    Google OAuth callback (GSC connect)
    inngest/            Inngest webhook handler
  dashboard/            Authenticated area
    keywords/           Table view
    brief/              Weekly AI brief
    connect-google/     GSC OAuth start
  page.tsx              Landing (OTP form)
  verify/page.tsx       OTP code entry
db/
  schema.ts             Drizzle schema
  client.ts             DB client + tenantDb() wrapper (required for multi-tenant)
lib/
  auth.ts               Better Auth config
  auth-client.ts        Client-side auth helpers
  google-oauth.ts       Google OAuth for GSC API
  encryption.ts         AES-256-GCM for refresh_tokens at rest
  dataforseo.ts         SERP API client
  inngest/
    client.ts           Inngest client + event types
    functions.ts        All cron + async functions
  llm/
    brief.ts            Anthropic brief generator
components/
  ui/                   shadcn components
  rank-delta.tsx        Up/down arrow with delta
  sign-out-button.tsx
```

## Multi-tenant safety

Never use raw `db` in request handlers. Always use `tenantDb(session.user.id)`:

```ts
const t = tenantDb(session.user.id);
const keywords = await t.selectKeywords(); // scoped automatically
```

Direct `db` access is reserved for Inngest functions and admin tools that
explicitly know what they are doing.

## Deployment

Vercel supports Bun natively. Push to main, set env vars in Vercel dashboard,
deploy. See https://vercel.com/docs/frameworks/bun.

The Inngest webhook needs `INNGEST_SIGNING_KEY` set in prod. Register your
Vercel URL with Inngest via the dashboard or `inngest-cli`.

## Status (initial scaffold)

| Component | State |
|-----------|-------|
| Stack wired | done |
| Better Auth OTP flow | done (needs live Resend key) |
| Google OAuth callback | done (needs live Google creds) |
| DB schema + tenant wrapper | done |
| DataForSEO client | done (needs live creds) |
| Inngest daily fetch + weekly brief | skeleton, untested against live data |
| AI brief generator | done (needs live Anthropic key) |
| Keywords UI | done (no Add keyword form yet) |
| Brief UI | done (checkboxes don't persist yet) |
| GSC auto-import top 20 on connect | TODO (weekend 2) |
| Sparkline chart in table | TODO |
| Email brief delivery (Resend) | TODO |
| Tests + golden-set eval | TODO |
