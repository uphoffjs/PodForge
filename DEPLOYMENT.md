# Deployment Guide

## Architecture

- **Frontend**: React SPA hosted on Vercel
- **Backend**: Supabase (Postgres database + Realtime + RPC functions)

## Prerequisites

- Node.js 18+ and npm
- Supabase account (<https://supabase.com>)
- Vercel account (<https://vercel.com>)
- Supabase CLI (`npm i -g supabase`)

## 1. Supabase Setup

### Create Project

1. Go to <https://supabase.com/dashboard> and create a new project
2. Note your project URL and anon key from **Project Settings > API**

### Apply Database Migrations

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

This applies four migrations:

- `00001_initial_schema.sql`: Core schema (events, players tables, RLS policies, RPCs)
- `00002_rounds_pods_admin.sql`: Rounds, pods, pod_players tables, admin RPCs
- `00003_realtime_replica_identity.sql`: REPLICA IDENTITY FULL for Realtime filtering
- `00004_timer_system.sql`: Round timers table, timer RPCs (start, pause, resume, extend, cancel)

### Enable Realtime

1. Go to **Database > Replication** in the Supabase Dashboard
2. Enable Realtime for tables: `events`, `players`, `rounds`, `pods`, `pod_players`, `round_timers`

### Configure RLS

RLS policies are applied via migrations. Verify they are active:

1. Go to **Authentication > Policies**
2. Confirm policies exist for all tables

## 2. Vercel Deployment

### Environment Variables

Set these in Vercel project settings (**Settings > Environment Variables**):

| Variable                  | Source                                                        |
| ------------------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase Dashboard > Project Settings > API > Project URL     |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard > Project Settings > API > anon/public key |

### Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (first time: follow prompts to link project)
vercel

# Production deployment
vercel --prod
```

### Deploy via GitHub Integration

1. Import your repository at <https://vercel.com/new>
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
6. Deploy

### SPA Routing

Vercel handles SPA routing automatically for Vite projects. The `/event/:eventId` routes will work without additional configuration.

## 3. Post-Deployment Verification

1. Visit your Vercel URL
2. Create a new event (should redirect to event page)
3. Open the event link on a second device/browser
4. Join as a player -- verify real-time player list updates
5. Generate a round -- verify pod assignments appear on both devices
6. Start a timer -- verify countdown is synchronized

## Environment Variables Reference

| Variable                  | Required   | Description                                                      |
| ------------------------- | ---------- | ---------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Yes        | Supabase project URL                                             |
| `VITE_SUPABASE_ANON_KEY` | Yes        | Supabase anonymous/public API key                                |
| `SUPABASE_DB_PASSWORD`    | Local only | Database password for `supabase db push` (in `.env`, gitignored) |

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npx vitest --run        # Unit tests
npx cypress run          # E2E tests

# Build for production
npm run build
npm run preview          # Preview production build locally
```
