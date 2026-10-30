# SubTrack — MVP requirements (v1.0)

## Purpose and audience
Public responsive web app usable by anyone without signing up. Users manually track **subscriptions only** (e.g. streaming, SaaS, software). The MVP stores records locally in the current browser/device.

## MVP capabilities
- Create, view, edit, delete subscriptions (confirm deletion).
- Mark subscriptions active or paused and resume them.
- Category assignment.
- Dashboard with count of active subscriptions, monthly equivalent spending, annual equivalent spending, and upcoming scheduled charges.
- Calculate recurring charge dates and normalize dates that are past, without claiming payments actually occurred.
- Persist to LocalStorage across page reloads.
- Responsive layout, usable on mobile, clear first-run empty state.
- Import/export a versioned JSON backup before public release.
- Search/filter are desirable, but lower priority.

## Screens
Approved design: desktop-first responsive web layout with top navigation. Tables adapt to cards on narrow screens. This release is a web application, not a native mobile app.

1. Dashboard: active subscriptions, budget equivalents by currency, upcoming scheduled charges.
2. Subscriptions: list, edit/delete, active/paused state, optional search/filter.
3. Reusable create/edit subscription form (modal or page).

Approved form presentation: reusable accessible modal. Upcoming scheduled charges include all occurrences in a 30-day interval starting today. JSON imports replace the full document after validation, count preview, and explicit confirmation.

## Subscription fields
| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID/string | system | Unique record ID. |
| `name` | string | yes | Nonempty, max 80 characters. |
| `amountMinor` | integer | yes | Positive price in currency's minor unit. |
| `currency` | string | yes | ISO 4217 code, e.g. MXN, USD, EUR; format with currency-aware minor digits. |
| `billingCycle` | enum | yes | weekly, monthly, quarterly, yearly. |
| `nextBillingDate` | string | yes | YYYY-MM-DD, local calendar date. |
| `billingAnchorDate` | string | system | Stable original calendar reference; preserves day, month and cycle phase. |
| `category` | enum | yes | entertainment, streaming, fitness, education, cloud, software, other. |
| `status` | enum | yes | active, paused. |
| `notes` | string | no | Optional. |
| `createdAt` | ISO datetime | system | Generated automatically. |
| `updatedAt` | ISO datetime | system | Updated automatically. |

Example TypeScript contract:

```ts
export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "active" | "paused";
export type SubscriptionCategory =
  | "entertainment" | "streaming" | "fitness" | "software"
  | "education" | "cloud" | "other";

export interface Subscription {
  id: string;
  name: string;
  amountMinor: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  billingAnchorDate: string;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Example subscription
```json
{
  "id": "8bc2d7a0-3219-4a01-83f3-2c69379dc481",
  "name": "Netflix",
  "amountMinor": 24900,
  "currency": "MXN",
  "billingCycle": "monthly",
  "nextBillingDate": "2026-10-30",
  "billingAnchorDate": "2026-10-30",
  "category": "entertainment",
  "status": "active",
  "createdAt": "2026-10-28T20:00:00Z",
  "updatedAt": "2026-10-28T20:00:00Z"
}
```

## Business rules
- Monthly equivalent: weekly amount * 52 / 12; monthly amount; quarterly amount / 3; yearly amount / 12.
- Annual equivalent: monthly equivalent * 12. Display formatted amounts with sensible rounding; retain integer minor units for stored amounts.
- A monthly equivalent is a **budget average**, not a guarantee that charges will occur in that specific calendar month.
- Calculate totals **separately for each currency**; do not add MXN + USD, etc.
- Preserve the stable `billingAnchorDate` for recurrence; e.g., Jan 31 -> Feb 28 -> Mar 31. Annual Feb 29 clips to Feb 28 in non-leap years and returns in leap years. Pause/resume preserves this anchor; editing the date or frequency establishes a new reference. `nextBillingDate` remains the entered reference/lower bound; displayed upcoming dates are derived.
- Weekly recurrence advances by 7 calendar days; monthly/quarterly/yearly use calendar-aware recurrence with month-end clipping.
- Past dates can be accepted on edit, but upcoming scheduled dates must be computed to the next valid occurrence; don't silently record a confirmed payment.
- Active subscriptions count toward budget equivalents/upcoming; paused subscriptions do not. Confirmed historical payments remain in actual spending regardless of current subscription status.
- Validate user input and imported backup data; gracefully handle invalid records.
- LocalStorage key: `subtrack:data:v1` with schema version 2 and `settings` for `defaultCurrency: "MXN"`, `locale: "es-MX"`.

## Architecture
Presentation (React pages/components) -> pure domain/business functions and services -> repository interface -> LocalStorage adapter in MVP. Future API adapter should be possible without rewriting presentation code, though authentication/sync will require additional changes.

## Tech choices
React + TypeScript + Vite; Tailwind CSS; Vitest; GitHub; optional Cloudflare Pages for static hosting. No server for v1.0.

## Out of scope for MVP
Login, multiple-device sync, automatic bank imports, notifications, automatic currency conversion, general bill tracking.

## Definition of done
- A subscription persists after refresh.
- Edit/delete update both list and dashboard.
- Periodic spending calculations pass automated tests.
- End-of-month recurrence follows an explicit stable anchor.
- Paused items are excluded from active metrics.
- Mixed currencies produce separate summaries.
- JSON export/import restores validated data.
- Main workflows function on small screens.

## Confirmed payments — approved 2026-10-29
- Add `Payment` records: id, subscriptionId, subscriptionName snapshot, amountMinor, currency, paidOn (YYYY-MM-DD), createdAt. Amount and currency are independent historical snapshots.
- Explicit confirmation only: never infer payment from a past scheduled date. Allow earlier payment dates, including earlier years; reject future dates and nonpositive/invalid amounts.
- “Pagado este año” sums payments from January 1 through today in the local calendar year, separately by currency. The annual budget equivalent remains separate. Three confirmed MXN 249 monthly payments total MXN 747, not MXN 2,988.
- Register payments from Mis suscripciones → Pagos. Review per-subscription history there or all payments through Dashboard → Ver pagos.
- Warn against duplicate confirmations (same subscription, date, amount and currency). Remove incorrect payments with explicit confirmation and recalculate totals.
- Pausing, renaming, repricing or deleting a subscription does not rewrite or remove historical payment snapshots. History stays available from the Dashboard even with no remaining subscriptions.
- Schema v2 includes a payments array. Read/migrate v1 documents with no payments to an empty history, without assuming any charges were paid. Keep the existing LocalStorage key `subtrack:data:v1` for continuity; the schemaVersion inside the document is 2.
- Export/import includes payments. Replacing with an older backup without payment history requires the same explicit replacement confirmation and warns that existing payments will be removed.
