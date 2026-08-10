# Fişlik (mobile)

Native Expo/React Native app for Fişlik. A small business ("mükellef") photographs
receipts and shares them with its accountant ("muhasebeci"); the accountant reviews,
downloads and reconciles them by month. This is the companion app to `fislik-web` and
talks to the same backend API.

## Prerequisites

- Node.js 20.x (matches CI — see `.github/workflows/ci.yml`)
- npm
- Xcode (for iOS builds/simulator) and/or Android Studio (for Android builds/emulator)
- An [EAS](https://docs.expo.dev/eas/) account if you'll run cloud builds or submissions

## Getting started

```bash
npm install
cp .env.example .env
npm run gen:api
npx expo start
```

`.env` holds `EXPO_PUBLIC_API_URL`, which defaults to `http://localhost:8000`. `npm run
gen:api` fetches `${EXPO_PUBLIC_API_URL}/openapi.json` and regenerates
`src/api/generated/schema.d.ts` — run it whenever the backend's API contract changes,
and re-run it if you point `EXPO_PUBLIC_API_URL` somewhere else before starting the app.

### Running on a physical device against a local API

The Expo dev client / Expo Go on a physical phone cannot reach `localhost` — that
resolves to the phone itself, not your computer. Set `EXPO_PUBLIC_API_URL` in `.env` to
your computer's LAN IP instead (e.g. `http://192.168.1.23:8000`), and make sure the
backend is listening on `0.0.0.0`, not just `127.0.0.1`. Simulators/emulators can
usually keep using `localhost` (Android emulator: `http://10.0.2.2:8000`).

The backend must have Bearer token auth deployed for the app's login/session flow to
work — it does, on both the local dev API and `https://fislik-api.selamet.dev`.

## Testing and type-checking

```bash
npm test           # jest
npx tsc --noEmit   # type-check only, no build output
```

Both must pass before committing. CI (`.github/workflows/ci.yml`) additionally runs
`npx expo-doctor`, `npx expo export --platform ios` (proves Metro resolves the `@/`
path alias, not just Jest's `moduleNameMapper`), and re-runs `npm run gen:api` to check
the checked-in generated schema is current.

## Conventions this codebase enforces

A few things aren't obvious from reading a single file, so they're worth stating up
front:

- **API payload types come only from the generated schema.** Never hand-write a type
  for a request/response body — import it from `src/api/generated/schema.d.ts` (via
  `npm run gen:api`). If the shape you need isn't there, the backend contract needs to
  change first.
- **Tests use `createTestQueryClient()`** (`src/test/queryClient.ts`) instead of a bare
  `new QueryClient()`, so retries/caching don't make tests slow or flaky.
- **Every endpoint needs a contract test** — see `src/api/__tests__/endpoints.contract.test.ts`.
  If you add or change an endpoint in `src/api/endpoints.ts`, add or update its
  contract test alongside it.
- **Colours only from `src/theme/tokens.ts`.** Components must reference
  `tokens.color.*`, never a hard-coded hex literal (asset files — icons, splash,
  images — are the one exception, for the obvious reason that they aren't styled at
  the component layer).
- **`fislik-web` is the reference for user-visible Turkish copy.** When porting a
  screen or string from web to mobile, match the web app's wording rather than
  inventing new phrasing.

## Building and submitting with EAS

Build profiles live in `eas.json`:

| Profile       | Distribution | API URL                          | Notes                          |
| ------------- | ------------ | --------------------------------- | ------------------------------- |
| `development` | internal     | `http://localhost:8000`           | Dev client build                |
| `preview`     | internal     | `https://fislik-api.selamet.dev`  | For ad-hoc/internal testing     |
| `production`  | store        | `https://fislik-api.selamet.dev`  | `autoIncrement` enabled         |

```bash
# Development client build (installs alongside Expo Go, connects to a local API)
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile development --platform android

# Preview build for internal testing against the production API
npx eas-cli build --profile preview --platform all

# Production build for store submission
npx eas-cli build --profile production --platform all

# Submit the most recent production build
npx eas-cli submit --profile production --platform ios
npx eas-cli submit --profile production --platform android
```

`submit.production` in `eas.json` is currently empty — App Store Connect / Google Play
credentials (API keys, service account JSON, etc.) need to be supplied interactively on
first submit, or added to `eas.json`/EAS secrets before running submit non-interactively.
See [Expo's submit docs](https://docs.expo.dev/submit/introduction/) for the exact
fields.

## Store assets — status

`assets/icon.png`, `assets/adaptive-icon.png` and `assets/splash.png` are real
Fişlik-branded artwork (rendered directly from the same vector geometry as
`fislik-web`'s `FislikMark.tsx` and matched against `fislik-web/public/icons/icon-512.png`),
not placeholders. Before submitting to the stores, a human should still:

- Confirm the icon renders correctly across iOS's icon shapes (circle, squircle,
  rounded square) and Android's various launcher masks on a real device/simulator —
  it was verified at 1024×1024 and against the safe-zone proportions, not eyeballed
  on-device.
- Provide Play Store/App Store *listing* assets (screenshots, feature graphic, promo
  text) — those are marketing assets, out of scope for this repo's `assets/` directory.
- Supply EAS submit credentials (see above).
