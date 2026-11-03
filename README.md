# Kavango East Education — conference room bookings

A complete, portable website for the Directorate of Education, Kavango East, Rundu. It has two rooms, **Big** and **Small**, a public schedule, and a simple booking form. Visitors do not need accounts.

The booking form is visible immediately alongside the schedule. There is one booking button, no sidebar or landing screen, and optional meeting details stay collapsed until needed.

For an alternative using existing work Outlook accounts, see [M365-OPTION.md](M365-OPTION.md).

## Deploy the downloaded folder on Vercel

You need a Vercel account and a Neon database. There is no separate server to manage.

1. Extract the ZIP and open a terminal in the `kavango-room-booking` folder — the one containing `package.json` and `vercel.json`.
2. Install [Node.js 24 LTS](https://nodejs.org/) if it is not installed. Run:

   ```sh
   npx vercel
   ```

   Sign into Vercel, create a project and accept the settings from `vercel.json`. If asked, choose **Other** as the framework. The build command is `npm run build`; the output directory is `dist`. Deploy the whole project folder, including `api` and `lib`, rather than uploading only `dist`.

3. In that project's Vercel dashboard, open **Storage → Create Database / Marketplace → Neon**. Choose the **Free** plan and connect it to the project. If Vercel offers a choice, use a region close to your Vercel function region. The integration should add `DATABASE_URL` to the project's environment variables. Check that it is enabled for **Production**. Enable it for **Preview** too if you want preview deployments to use a database; a separate preview database is preferable when testing changes against an established production site.
4. Deploy again from the same folder:

   ```sh
   npx vercel --prod
   ```

   The first schedule request creates the booking table and overlap constraints automatically. No manual SQL is required. Open the production URL, make a test booking, check it from another device, then cancel it using the saved private link.

You can alternatively import the folder through a Git repository in Vercel and follow steps 3–4 by redeploying in the dashboard. Keep the root directory set to this project folder.

**Making it visible to everyone:** If Vercel shows a sign-in page before your site, review the project's Deployment Protection setting for the URL you are sharing. Use the production URL and configure access to match your intended public booking board. The application itself has no sign-in screen.

**Cost:** Neon advertised a $0 Free plan, no time limit and no credit card requirement when checked on 2 November 2026. It included 1 GB of database storage and 100 CU-hours per month per project. Usage depends on how often the page is used and how long the database remains active. Monthly compute or transfer limits suspend the free database rather than automatically moving it to a paid plan. Check the current plan shown during setup. Vercel hosting has its own plans and eligibility requirements; Neon's Free plan does not determine your Vercel hosting cost.

## Try it locally

The local preview can run with Node.js alone, without installing dependencies or setting up a database:

```sh
node scripts/dev.mjs
```

Open `http://localhost:3000`. A clearly labelled local preview stores its bookings in `.local-data/bookings.json`. It starts empty, supports multiple tabs on this computer and uses the same API validation and cancellation flow. These local bookings are not uploaded or copied into the production database.

For the full development commands and verification:

```sh
npm install
npm run dev
npm test
npm run build
```

To use your real shared database locally, copy `.env.example` to `.env.local`, enter your Neon `DATABASE_URL`, install dependencies, and run `npm run dev`. Treat the connection string as a password. It stays on the server and is never included in the browser files. With a real connection configured, local actions affect that database, so use a separate development database if production already contains bookings.

`npm run db:setup` can also initialize a database explicitly. It is optional because production initializes itself.

## How booking works

- The schedule shows the organiser, meeting title, department, room and reserved time. Meeting title and department are optional; the name, room, date, start and duration are required.
- Day and week views share the same data. The **My bookings** checkbox shows upcoming reservations made or saved in the current browser. All scheduling uses **Africa/Windhoek (CAT / UTC+2)**, regardless of the visitor's device time zone.
- Choose a free time in the schedule to fill in the visible booking form, or enter the room, date and time directly. Changing the booking date also updates the schedule.
- The normal day view shows 07:00–18:00 and expands when a reservation falls outside those hours. **Show full day** displays 00:00–24:00. Reservations can start at other times, include weekends, and last up to 24 hours across midnight. Durations use 15-minute steps. Bookings can be made up to a year ahead.
- A PostgreSQL exclusion constraint blocks overlapping times **inside the database**, including simultaneous requests. A meeting may start exactly when the previous meeting ends. The rooms can be used at the same time.
- The page checks for updates every minute while visible and provides a manual **Refresh** button. New bookings and cancellations update immediately for the person performing them. Other open pages see them at their next refresh. This is polling, not an instant push service.
- **My bookings** remembers cancellation access in the browser. There are no passwords, emails or user accounts. The confirmation also provides a private cancellation link that works on another device. The link does not cancel anything until the visitor confirms cancellation.
- Public API responses never include cancellation tokens or their hashes. Only the browser that made the booking, or someone given that booking's private link, can cancel it. Without an account, a lost link plus cleared browser data cannot be automatically recovered by proving identity.
- **Add to calendar** downloads an `.ics` file for common calendar apps. That copy is separate from the shared room schedule; cancelling here does not remove a previously imported calendar event.

## Why this setup

The frontend is plain HTML, CSS and JavaScript, so it has no framework build or runtime to maintain. Vercel serves those files and runs a single small booking function. Neon stores the shared records permanently. A file saved inside a Vercel function or a browser's local storage would not provide a dependable shared schedule. A single shared JSON file also needs careful coordination to avoid lost updates; the database directly enforces the room overlap rule.

The deployed application deliberately returns an unavailable state if the database is missing or unreachable. It never silently switches visitors to independent local schedules.

## Branding and local assets

The website identifies the Directorate of Education, Kavango East, Rundu. It includes a locally stored Namibian national coat of arms and a simple green and neutral layout. No external fonts, tracking scripts or room photos are loaded.

The official Directorate page confirmed the institutional identity. The government site's human-verification screen prevented a complete visual inspection, so the regional website's exact fonts, colour specifications and Kavango East crest could not be verified. This project does **not** claim to reproduce an approved Directorate brand manual. The national coat of arms is an existing symbol, not an invented regional logo. Replace or supplement `public/assets/namibia-coat-of-arms.svg` with the Directorate's supplied official artwork if needed; theme colours are at the top of `public/styles.css`.

## Files

| Path | Purpose |
| --- | --- |
| `public/` | All browser files and the local coat of arms |
| `api/bookings.js` | Vercel's shared booking endpoint |
| `lib/` | Validation, database constraints, storage and request handling |
| `scripts/` | Local preview, static build and optional database initialization |
| `tests/` | API checks and real PostgreSQL constraint checks using PGlite |
| `vercel.json` | Vercel configuration and browser response headers |
| `.env.example` | Example server-side database setting |

## Verification

Automated checks cover invalid dates, past dates, duration limits, explicit Namibia time, overnight bookings, simultaneous overlap rejection, adjacent bookings, both rooms, idempotent retries, cancellation ownership and production behavior without a database. PostgreSQL constraints are exercised against PGlite, an embedded PostgreSQL engine. Desktop and phone layouts and the create/conflict/cancel flows were also checked in a browser.

A real Neon connection and a production Vercel deployment still require your account setup; they are not included or pre-provisioned in this folder. The database initialization and serverless integration should be confirmed with the deployment smoke test in step 4.

## Sources

- [Official Directorate of Education page](https://kavangoeastrc.gov.na/education)
- [National coat of arms artwork and public-domain file information](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Namibia.svg)
- [Vercel: Postgres integrations](https://vercel.com/docs/postgres)
- [Vercel: deploy a local project](https://vercel.com/docs/cli/deploy)
- [Neon on Vercel Marketplace](https://vercel.com/marketplace/neon)
- [Neon pricing](https://neon.com/pricing)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [PostgreSQL range exclusion constraints](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT)
