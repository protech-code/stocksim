# StockSim

**A virtual stock exchange for learning, experimentation, and paper trading.** Practice investing with simulated cash. StockSim does not execute real securities transactions and is not financial advice.

> Status: early MVP scaffold. Market quotes are demo seed data until a real quote provider is configured. Android build instructions are provided; no APK is published yet.

## Stack

- **Web:** React, TypeScript, Vite, Recharts
- **API:** Node.js 20+, Express, TypeScript, Zod
- **Data/Auth:** Supabase PostgreSQL and Supabase Auth
- **Android:** Capacitor wrapper workflow

## Repository layout

```
apps/api/                 Express API and trading endpoints
apps/web/                 Responsive trading dashboard
apps/mobile/              Android build instructions
supabase/migrations/      Database schema, RLS, seed stocks, trading RPC
```

## Local setup

1. Install Node.js 20 or newer.
2. Create a Supabase project.
3. Run `supabase/migrations/0001_initial.sql` in the Supabase SQL Editor.
4. Copy `.env.example` to `apps/api/.env` and configure the API variables.
5. Copy `.env.example` to `apps/web/.env` and configure the `VITE_*` variables.
6. Install and start:

```bash
npm install
npm run dev
```

Web: http://localhost:5173 · API: http://localhost:4000/health

### Environment security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or Android app, or use it in a `VITE_*` variable.
- The API validates Supabase access tokens before using its server-only service-role client.
- Keep real environment files out of Git.

## Trading model

- New Supabase Auth users receive **$100,000 virtual cash** through a database trigger.
- Market orders execute against the latest stored simulated quote.
- A 0.10% simulated fee applies to filled orders.
- Database transactions lock account and position rows to prevent overspending or selling more shares than owned.
- Seed quotes are static demo data, not live prices.

## Android

See [apps/mobile/README.md](apps/mobile/README.md). Build the web app, initialize Capacitor, add Android, sync, and open the project in Android Studio to build an APK.

## Next steps

Automated tests, portfolio history, watchlists, order history pagination, admin tools, market-data provider integration, Android icons/signing, and CI.

## License

MIT — see [LICENSE](LICENSE).

## Credits

ProTech Group × NEXORA Contributors
