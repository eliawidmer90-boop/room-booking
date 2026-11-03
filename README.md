# Kavango East Education — room and vehicle booking

A plain booking board for the Directorate of Education, Kavango East, Rundu. Two tabs show the booking form and shared schedule immediately. There are no accounts or approval steps.

**Updating the existing GitHub → Vercel site? Start with [UPDATE-GITHUB.md](UPDATE-GITHUB.md).** Keep the same repository, Vercel project and Neon database.

## What is included

- **Room Booking:** Big and Small conference rooms, with the existing booking and cancellation behavior.
- **Vehicle Booking:** Single Cab 1, Single Cab 2, Double Cab 1, Double Cab 2 and Bus (13-seater).
- Vehicle reservations have departure and return dates/times and can cover several days. Driver, destination and purpose are optional.
- Public schedules show who booked each resource and when. Click a reservation to see the details.
- Day and week views, a vehicle filter, and **My bookings** for upcoming reservations remembered in this browser.
- All times use Rundu time: **Africa/Windhoek, CAT (UTC+2)**, including on devices in other time zones.
- Room durations use 15-minute steps, up to 24 hours. Vehicle departure/return times use 15-minute steps; a trip can span up to 366 days. Departures and room bookings can start up to one year ahead.
- Separate resources can be used at the same time. PostgreSQL exclusion constraints prevent overlapping reservations for the same room or vehicle, including simultaneous requests. A booking can begin exactly when the earlier booking ends.
- Visible schedules refresh every minute. A manual Refresh button is also available. Other visitors see changes on their next refresh.

## Existing database and bookings

The update uses the existing server-side `DATABASE_URL` setting. It adds a `vehicle_bookings` table in the same Neon database. The first vehicle API request creates that table and its constraints automatically. No manual SQL, database reset or additional Neon database is required.

The original `room_bookings` table, IDs and cancellation hashes are retained. Original room cancellation links and browser ownership storage remain compatible. Vehicle bookings use separate cancellation storage and links.

Only a browser holding the reservation's private cancellation key, or someone using its private cancellation link, can cancel it. No account is required. Keep that link if you need access from another device. Clearing browser data and losing the link removes your cancellation access. The public API never returns cancellation keys or their hashes.

## Local preview

Install Node.js 24. From this folder run:

```sh
node scripts/dev.mjs
```

Open `http://localhost:3000`. Without `DATABASE_URL`, the preview stores room and vehicle reservations separately under `.local-data/`. It starts empty. These files are excluded from Git and from the supplied ZIPs; they do not populate the deployed database.

For normal development and checks:

```sh
npm install
npm run dev
npm test
npm run build
```

The supplied `pnpm-lock.yaml` is retained from the original repository. The update adds no dependencies. You can use `pnpm install --frozen-lockfile`, `pnpm test` and `pnpm build` instead.

To use a shared database locally, copy `.env.example` to `.env.local`, enter its Neon connection string, and run `npm run dev` after installing dependencies. Actions affect the database in that setting. Use a separate Neon branch/database for isolated testing. Never upload `.env.local` or a connection string to GitHub.

`npm run db:setup` initializes both tables explicitly if wanted. It is optional because each deployed API initializes its own table automatically.

## Vercel

Keep the project rooted in the folder containing `package.json` and `vercel.json`. The framework preset is **Other**, build command `npm run build`, output directory `dist`, and Node version 24.x. Vercel hosts the browser files and two API functions. Upload the source folders, including `api` and `lib`; uploading only `dist` cannot provide shared bookings.

Production needs `DATABASE_URL` connected to the existing Neon database. Preview deployments also need a Preview environment variable if you want shared booking tests there. A preview pointing to the production connection acts on real bookings; a separate Neon branch provides isolation.

The deployed APIs return an unavailable message when the database is missing or unreachable. They never silently switch to local data.

The existing Vercel Analytics script and its response-header permissions are preserved from the supplied GitHub archive. No Analytics package changes are needed.

## Files

| File/folder | Purpose |
| --- | --- |
| `public/index.html`, `public/styles.css`, `public/tabs.js` | Page, styling and the two tabs |
| `public/app.js` | Existing room interface, now scoped to its tab |
| `public/vehicles.js` | Vehicle form, schedule and cancellation interface |
| `public/vehicle-catalog.js` | The five vehicle names and permanent IDs |
| `api/bookings.js`, `api/vehicle-bookings.js` | Room and vehicle Vercel endpoints |
| `lib/` | Validation, storage, request handling and database constraints |
| `scripts/` | Local preview, build and optional database setup |
| `tests/` | Room/vehicle API and actual PostgreSQL constraint tests using PGlite |
| `UPDATE-GITHUB.md` | Upload instructions and exact changed/new file list |

Vehicle IDs identify stored bookings. Renaming a display label is safe; adding/removing IDs requires a corresponding database migration for the fixed constraints. Do not change IDs to rename a vehicle.

## Verification and deployment check

Eight automated checks cover room and vehicle validation, simultaneous conflicts for every vehicle, adjacent reservations, multi-day listing, Namibia time, cancellation ownership, safe retries, missing database configuration and preservation of existing room bookings. Desktop and phone layouts, public details, conflicts, saved cancellation links and the original room flow were checked in a local browser.

These checks use local data and embedded PostgreSQL. A live Neon connection was not available during preparation. After deployment, create one short vehicle reservation, check it in another browser/device, cancel it, and confirm the existing room schedule still loads.

## Identity and artwork

The existing national coat of arms and green/neutral layout are retained. The project identifies the Directorate of Education, Kavango East, Rundu. Exact compliance with a Directorate brand manual has not been verified; replace artwork with approved material if supplied.

- [Directorate of Education](https://kavangoeastrc.gov.na/education)
- [National coat of arms artwork](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Namibia.svg)
- [Vercel domains](https://vercel.com/docs/domains/working-with-domains)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [PostgreSQL exclusion constraints](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT)

The earlier Microsoft 365 alternative remains in [M365-OPTION.md](M365-OPTION.md).
