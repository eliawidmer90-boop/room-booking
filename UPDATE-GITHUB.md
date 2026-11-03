# Add Vehicle Booking to the existing site

Use **room-vehicle-booking-update.zip** for your existing repository. It contains only the changed files and new files. The separate **room-vehicle-booking-complete.zip** contains the whole updated project as a backup or for a fresh checkout.

**Do not delete your repository, its folders, your Vercel project or your Neon database. You do not need to edit code by hand.** Upload the prepared files over the matching paths on your existing `add vehicle booking` branch.

## Upload through GitHub

1. Download and extract **room-vehicle-booking-update.zip** on your computer.
2. Open your existing GitHub repository. Use the branch selector to choose your **add vehicle booking** branch. Check that you are at the repository root, where `package.json` is visible.
3. Choose **Add file → Upload files**.
4. Open the extracted update folder. Drag its **contents** onto GitHub: the `api`, `lib`, `public`, `scripts` and `tests` folders and the files beside them. Include `.gitignore` and `.env.example` if your file manager hides files beginning with a dot.
5. Check the paths in the upload list. They must look like `public/index.html` and `api/vehicle-bookings.js`, with no extra `room-vehicle-booking-update/` folder in front. Upload the extracted files, not the ZIP itself.
6. Give the commit a message such as **Add vehicle booking tab** and choose to commit directly to the branch you already created. Click **Commit changes**. Matching files are updated; new files are added. Files absent from this update stay in the repository.
7. On GitHub, create a pull request from your updated branch **into `main`**. The title can be **Add vehicle booking**. Review the file changes and Vercel check/preview.
8. Test the preview when its database connection is available, then merge the pull request into `main`. Your existing Vercel Git integration normally deploys the merge automatically. Check Vercel for a successful **Ready / Production** deployment before sharing the updated site.

GitHub Desktop is another option: clone the repository, switch to the same branch, copy the extracted update contents into that local repository folder (accept replacing matching files), then commit and push. The same pull-request steps apply.

## Vercel and Neon

- Keep your current `DATABASE_URL`, project settings and Neon connection. No new database or manual SQL is needed.
- Opening the Vehicle Booking tab on the deployed site creates `vehicle_bookings` automatically, alongside the original `room_bookings` table. Existing room records are retained.
- Your Vercel Analytics script is preserved. `package.json` and `pnpm-lock.yaml` are unchanged; there are no new dependencies.
- A branch preview needs `DATABASE_URL` enabled for the **Preview** environment. If it is missing, the preview shows a service unavailable/setup message. Add the Preview connection and redeploy that preview to test it.
- A preview using your production connection reads and writes the real bookings. If you want isolated tests, connect the Preview environment to a separate Neon branch instead. Production should keep its existing connection.

## After the deployment

1. Open the normal production address. Room Booking should still show Big and Small.
2. Open Vehicle Booking. Confirm all five vehicles appear.
3. Make a short test reservation and check the same time in another browser/device. Its name and time should be visible.
4. Try booking the same vehicle at an overlapping time. It should show a conflict. Another vehicle should remain available.
5. Open your reservation and cancel it. Use the confirmation's private link if checking from another device. Confirm that the time is available again.

No accounts or approval process have been added. A booking's cancellation access is saved in that browser, with a private link for use elsewhere.

## Exact files in this update

### Replace these 9 existing files

| Path | Change |
| --- | --- |
| `README.md` | Updated project/deployment instructions |
| `vercel.json` | Adds the vehicle API function; retains existing Analytics permissions |
| `lib/handler.mjs` | Lets the two APIs use their respective validation rules |
| `public/index.html` | Two tabs and the vehicle form/schedule |
| `public/styles.css` | Tab and vehicle layout styling |
| `public/app.js` | Scopes existing room interactions to the Room Booking tab |
| `scripts/dev.mjs` | Local preview supports both booking types |
| `scripts/setup-db.mjs` | Optional setup initializes both tables |
| `scripts/build.mjs` | Build status message identifies both API functions |

### Add these 11 new files

| Path | Purpose |
| --- | --- |
| `.gitignore` | Excludes local bookings, credentials and installed/generated files |
| `.env.example` | Empty example of the existing database setting |
| `UPDATE-GITHUB.md` | This guide |
| `api/vehicle-bookings.js` | Vehicle booking endpoint |
| `lib/vehicle-booking.mjs` | Vehicle booking validation |
| `lib/vehicle-schema.mjs` | Non-destructive vehicle table initialization and overlap constraints |
| `lib/vehicle-store.mjs` | Shared database and local preview vehicle storage |
| `public/tabs.js` | Switches between the two tabs |
| `public/vehicle-catalog.js` | Your five vehicle names and permanent IDs |
| `public/vehicles.js` | Vehicle booking form, schedule and cancellation |
| `tests/vehicles.test.mjs` | Vehicle API/database checks and room-record preservation check |

All other files from the supplied GitHub ZIP remain unchanged. No files need to be deleted. The ZIPs contain no database credentials, local test bookings, installed dependencies or generated build output.

## Changing the address later

Use your existing Vercel project's **Settings → Domains** to add another available `.vercel.app` address or a domain you own. Keep the same project and database to retain bookings. You do not need a new GitHub repository.

Browser cancellation access is tied to the address used when booking. A new address does not inherit the old address's browser storage. Keep the old address working during the change so old private cancellation links still work. The private link's booking ID/key can also be used at the new address, with the same `#cancel=...` or `#vehicle-cancel=...` part.

[Vercel domain setup](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
