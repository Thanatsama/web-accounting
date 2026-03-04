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
    page.tsx            # Overview page
    features/           # Features page + local CSS module
    pricing/            # Pricing page + local CSS module
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
