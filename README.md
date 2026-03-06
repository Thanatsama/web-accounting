## Web Accounting

Apple-inspired landing page scaffold using:
- Next.js (App Router)
- TypeScript
- Material UI (MUI)

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project structure

```text
src/
  app/
    layout.tsx          # Root layout + theme provider mount
    page.tsx            # Home page
    table/              # Table page + local CSS module
    plan/               # Plan page + local CSS module
    globals.css         # Global styles/reset
  components/
    layout/             # Header/Footer
    navigation/         # Clickable pagination component
    providers/          # AppThemeProvider
  theme/
    theme.ts            # Centralized MUI theme
```

## Scripts

- `npm run dev` - start dev server
- `npm run lint` - run lint checks
- `npm run build` - build production bundle
- `npm run start` - start production server

## Notes

- Designed to be easy to read and extend by keeping theme, layout, and content modules separated.

## Use on another computer (without local run commands)

Deploy with Vercel:
1. Push this project to GitHub.
2. Go to [Vercel](https://vercel.com), import the GitHub repo.
3. Deploy (Vercel handles install/build/start automatically).
4. Open the Vercel URL from any computer.

Data safety:
- Use `Backup Data` in the account menu to export JSON.
- Use `Restore Data` in the same menu on another device to import your data back.

## Firebase sync (server-side, no login required)

The app now writes/reads Firestore via Next.js API (`/api/budget`) using `firebase-admin`.
Client does not access Firestore directly.

Set server environment:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (use `\\n` for line breaks)

Behavior:
- Refresh page: app reads latest snapshot from server API.
- Edit/add/update: app writes snapshot to server API immediately.

Initial seed:
- Run app (`npm run dev`)
- Run `npm run seed:firebase` to upload `data/budget.json` through the server API.
