# HisabKitaab

**No confusion. Just Hisab.**

A simple money-record app for local shops, small businesses and families: see who owes you, add a record in seconds, and send a polite reminder. Web app, Android app, one shared Firebase backend.

| | |
|---|---|
| Web app | https://hisabkitaab--ideathon-projects.us-central1.hosted.app |
| Download page + Android APK | https://hisabkitaab-ideathon.web.app (APK: `/downloads/HisabKitaab.apk`) |
| API (Cloud Function `hkApi`) | https://hisabkitaab-ideathon.web.app/api/messages/capabilities |
| Firebase project | `ideathon-projects` (named Firestore database `hisabkitaab`) |

---

## What it does

- **Sign up / log in / log out / reset password** (Firebase Auth, email + password, session persists).
- **People**: add, edit, archive (only when settled), delete (only when they have no history). Search by name or phone, filter by To Receive / To Pay / Overdue / Settled. On Android, pick a person straight from phone contacts.
- **Add Hisab**: "Money I should receive" or "Money I need to pay", amount in ₹, optional note, due date and category. A new person can be created inside the same form.
- **Dashboard**: To Receive, To Pay and Overdue totals, who owes you (with Remind), who you owe, due this week, recent activity.
- **Person page**: balance, full history of entries and payments, Add / Send Reminder / Record Payment / Mark as Paid.
- **Payments**: full or partial. A payment is its own record and is spread over the person's open entries (earliest due first). Entries are never deleted or rewritten, so history stays intact.
- **Reminders**: message generated from the person's name, amount, note, due date and your business name. Send through a server gateway (SMS/WhatsApp) when configured, otherwise open WhatsApp, the SMS app or the share sheet, or copy. Every send is logged with an honest status.
- English UI with a translation layer; Hindi and Hinglish are partially translated and fall back to English.

## Repository layout

```
apps/
  web/            Next.js 16 app: landing page + the product (also what the Android app shows)
  mobile/         Capacitor 8 Android shell + native plugin (contacts, SMS, WhatsApp, share)
packages/
  shared/         Business logic shared by web, mobile and functions (TypeScript source)
functions/        Cloud Functions codebase "hisabkitaab" (messaging API), bundled with esbuild
firebase/         firestore.rules, firestore.indexes.json, security-rules tests
hosting/          Firebase Hosting site: download page + APK
firebase.json     Firestore (named DB), Functions, Hosting and App Hosting config
```

### `packages/shared`: one source of truth

| Module | Purpose |
|---|---|
| `types.ts` | Data model. Money is **integer paise** everywhere. |
| `calc.ts` | The only place balances are computed: outstanding, status, overdue, per-person balances, dashboard summary, payment allocation. |
| `money.ts`, `phone.ts`, `dates.ts` | ₹ formatting with Indian grouping (₹12,34,567), rupee parsing, Indian phone normalisation to E.164, due-date labels. |
| `validation.ts` | zod schemas used by the apps and the server. Errors are translation keys. |
| `people.ts` | Search (name prefix, surname, phone digits with or without +91) and filters. |
| `messages/` | Message templates, `MessageService` and its providers. |
| `server/` | Server-only gateway providers (Twilio, mock). |
| `data/` | Firestore reads/writes (both apps use the same functions, so the same invariants apply). |
| `react/` | `HisabProvider` and hooks shared by the apps. |
| `i18n/`, `analytics.ts`, `theme.ts` | Strings, privacy-safe typed analytics events, design tokens. |

## Data model

Everything lives under the signed-in user, in the named database `hisabkitaab`:

```
users/{uid}                        profile: name, business name, phone, language, preferences
users/{uid}/contacts/{id}          person: name, phone (E.164), email?, notes?, archived
users/{uid}/transactions/{id}      entry: contactId, type RECEIVABLE|PAYABLE, amount, paidAmount,
                                   status ACTIVE|PARTIALLY_PAID|PAID, note, category, dueDate,
                                   reminderEnabled, messageStatus
users/{uid}/payments/{id}          payment: contactId, type, amount, allocations[{transactionId, amount}]
users/{uid}/messages/{id}          reminder log: channel, status, body, to, provider, error
```

- **Balances are derived, not stored.** The app keeps two listeners (contacts + open entries) and computes every total through `calc.ts`. There is no cached total that can drift.
- **OVERDUE is derived** from `dueDate` at read time; it is never written.
- **Payments** run in a Firestore transaction that re-reads the affected entries, so two devices cannot over-settle an entry. Payments need a connection; everything else works offline and syncs later.
- Queries are bounded: dashboard and people use the open-entries listener; person history, recent activity and paid entries are paginated.

## Security

- `firebase/firestore.rules` gives each user access only to `users/{their uid}/**`. Everything else is closed.
- The rules also enforce money invariants: positive integer amounts, entry amount/type/person never change, `paidAmount` only grows and never exceeds the amount, status must match `paidAmount`, payments and message logs are append-only, and entries with payments can't be deleted.
- **Message status can't be forged**: clients may only record `SHARED` (they opened WhatsApp or a share sheet). `SENT`, `FAILED` and `SIMULATED` are written only by the Cloud Function with the Admin SDK.
- The messaging API verifies the Firebase ID token and **rebuilds the message server-side** from the caller's own records, so it cannot be used to text arbitrary content or numbers. It is rate limited per user.
- HisabKitaab uses its **own named Firestore database** so its rules never affect other apps in `ideathon-projects`. Note that Firebase Auth accounts are project-wide.
- No secrets are committed. `apphosting.yaml` only contains the public Firebase web config (identifiers, not credentials). Gateway credentials belong in `functions/.env.<project>` or Secret Manager.

## Messaging

```
MessageService
 ├── ServerProvider SMS        → hkApi → gateway (Twilio today)
 ├── ServerProvider WHATSAPP   → hkApi → gateway (Twilio today)
 ├── WhatsAppLinkProvider      → wa.me link / WhatsApp app
 ├── SmsLinkProvider           → phone's SMS app, prefilled
 ├── ShareProvider             → system share sheet
 └── CopyProvider              → clipboard
```

| Status | Meaning |
|---|---|
| `SENT` | The gateway accepted the message. |
| `FAILED` | The gateway or network rejected it (shown with a retry). |
| `SHARED` | We opened WhatsApp, SMS or the share sheet. We can't confirm delivery, so we never claim it. |
| `SIMULATED` | Development `mock` provider. Logged, not delivered. |

Configure gateways in `functions/.env.ideathon-projects` (see `functions/.env.example`): `SMS_PROVIDER=twilio|mock`, `WHATSAPP_PROVIDER=twilio|mock` plus Twilio credentials. With nothing set (the current production state), reminders go out from the user's own WhatsApp or SMS, which always works. SMS to Indian numbers through a gateway needs DLT registration. To add another gateway (MSG91, Gupshup, Meta Cloud API), implement `GatewayProvider` in `packages/shared/src/server/providers.ts`.

## Local development

Requirements: Node 20+ (22 recommended), Java 11+ (Firestore emulator), and for the APK, the Android SDK.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local                   # emulator settings by default
printf "SMS_PROVIDER=mock\n" > functions/.env.local             # optional: exercise the server SMS path

npm run build:functions
npm run emulators:dev      # Auth :9099, Firestore :8080, Functions :5001, UI :4000
npm run dev:web            # http://localhost:3000
```

The emulators use the `demo-hisabkitaab` project, so no real Firebase project or credentials are needed. `npm run emulators` does the same and also persists data to `.emulator-data`.

### Web environment (`apps/web/.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | `true` for local emulators. |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config (public). |
| `NEXT_PUBLIC_API_BASE_URL` | `hkApi` base. Emulator: `http://127.0.0.1:5001/demo-hisabkitaab/asia-south1/hkApi`. Production: `https://hisabkitaab-ideathon.web.app`. |
| `NEXT_PUBLIC_ANDROID_APK_URL` | Download link shown on the landing page and in Settings. |

### Android app

`apps/mobile` is a Capacitor shell that loads the deployed web app (`capacitor.config.ts` → `server.url`) and adds a native plugin (`HisabNativePlugin.java`) for the contact picker (no contacts permission needed), prefilled SMS, WhatsApp / WhatsApp Business, and the share sheet. The web app detects the shell before first paint and opens straight into the product.

```bash
npm run build:apk          # cap sync + gradlew assembleDebug
# output: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
cp apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk hosting/downloads/HisabKitaab.apk
```

Bump `versionCode` / `versionName` in `apps/mobile/android/app/build.gradle` for each release.

## Deploying (project `ideathon-projects`)

Every command is scoped so nothing else in the shared project is touched.

```bash
npm run deploy:rules       # rules + indexes for the "hisabkitaab" database only
npm run deploy:functions   # functions codebase "hisabkitaab" (hkApi, asia-south1)
npm run deploy:hosting     # hisabkitaab-ideathon.web.app: download page, APK, /api rewrite
npm run deploy:web         # App Hosting backend "hisabkitaab" (builds apps/web)
```

**Before `deploy:web`, if `packages/shared` changed:** App Hosting builds `apps/web` on its own, so it uses a packed copy of the shared package (`apps/web/hisabkitaab-shared-0.1.0.tgz`). Run `npm run pack:shared`, then `npm install` so both lockfiles pick up the new tarball integrity, and commit the tarball and lockfiles. Locally, the web app always uses the live workspace source.

App Hosting settings (runtime, instances, public env) are in `apps/web/apphosting.yaml`.

## Testing

```bash
npm run check              # typecheck + lint + unit tests + rules tests
npm test                   # 64 unit tests: balances, partial/full payment, overdue, zero balance,
                           # mixed receive/pay, allocation, search, filters, validation, phone,
                           # money formatting, message templates, MessageService status honesty
npm run test:rules         # 19 emulator tests: user isolation, money invariants, append-only
                           # payments, no forged SENT status, profile rules
```

## Design

- Brand from the original pitch deck: navy `#002C49`, green `#00A86B`, and the brush wordmark (keyed out of the deck's logo, not redrawn).
- Tokens in `packages/shared/src/theme.ts`, mirrored as CSS variables in `apps/web/app/globals.css`. Light and dark themes follow the system.
- Plain language only: To Receive, To Pay, Add Hisab, Send Reminder. Amounts are always ₹ with Indian grouping.
- Mobile first: bottom navigation with a large Add button, bottom sheets, 48px touch targets. Desktop gets a sidebar and two-column dashboard.
- Motion is limited to feedback and state changes (sheet transitions, balance count-up, save confirmation) and turns off with reduced motion.

## Known limitations and next steps

- **Production has no SMS/WhatsApp gateway configured**, by choice: reminders are sent from the user's own phone and logged as `SHARED`. Add Twilio (or another gateway) credentials to enable server sends.
- **Scheduled reminders** are not running yet. The model is ready (`reminderEnabled`, `dueDate`, status/dueDate index); the next step is a scheduled function that sends through the same `hkApi` path.
- The Android app is a **debug-signed APK** for direct download (users allow "install unknown apps"). A Play Store release needs a release keystore and `assembleRelease`/AAB.
- The Android app needs a connection on first launch because it loads the hosted app; after that, Firestore's offline cache keeps records available.
- Hindi and Hinglish are partial. Add keys to `packages/shared/src/i18n/hi.ts` / `hinglish.ts`.
- Phase 3 items (reports, export, PDF statements, multiple businesses, staff accounts, recurring entries) are not built.

---

Built by The Golden Innovaters.
