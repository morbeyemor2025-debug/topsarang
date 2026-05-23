# RANGPRO SN

RANGPRO SN is a multi-tenant AI queue management MVP for hair salons in Senegal. It includes customer QR onboarding, a ChatGPT-style join flow, realtime ticket tracking, loud browser alerts before turn time, salon dashboards, barber management, QR poster generation, Supabase SQL migrations, and OpenAI-assisted conversation.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, RLS, Realtime
- OpenAI for conversational UX only
- Zod validation, repository/service architecture
- QR code generation

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill Supabase and OpenAI keys. Without keys, the app still runs with demo fallback data.

4. Run the app:

```bash
npm run dev
```

Open:

- Customer portal: `http://localhost:3000/join/toprangbi`
- Dashboard: `http://localhost:3000/dashboard/toprangbi`

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in SQL Editor or through Supabase CLI.
3. Enable Realtime for `queue_tickets` and `barbers` if not already active.
4. Create users with Supabase Auth.
5. Insert rows in `salon_members` to connect users to salons with roles: `owner`, `barber`, or `staff`.
6. Seed demo data:

```bash
npm run seed
```

## Architecture

- `app`: routes, pages, API endpoints
- `components`: reusable customer, dashboard, brand, and UI components
- `hooks`: realtime client hooks
- `lib`: Supabase clients, utilities, demo fallback data
- `repositories`: database access and tenant scoping
- `services`: AI and wait-time business logic
- `types`: shared TypeScript and Zod schemas
- `utils`: QR generation
- `supabase`: SQL migrations and seed scripts

## Production Checklist

- Configure Supabase env vars in Vercel.
- Configure `OPENAI_API_KEY`, `OPENAI_MODEL`, and `NEXT_PUBLIC_APP_URL`.
- Apply SQL migration and verify RLS policies.
- Create salon owner accounts and `salon_members` rows.
- Test QR code scan on mobile.
- Test realtime dashboard updates.
- Test audible browser alert after user interaction.
- Add domain `rangprosn.com` in Vercel.
- Keep service role key server-only.

## Deployment

1. Push this repository to GitHub.
2. Import the repo in Vercel.
3. Add environment variables from `.env.example`.
4. Set build command to `npm run build`.
5. Deploy.

OpenAI is intentionally not responsible for queue creation, ticket numbering, wait-time math, or queue progression. Those remain controlled by the backend.
