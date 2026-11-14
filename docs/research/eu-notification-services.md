# Which EU notification services could deliver Cadence's Notifications?

Research for [#2](https://github.com/roelnoort/cohort-005-project-fork/issues/2) (map: #1). Researched 2026-11-14 against vendor docs and pricing pages. Prices and plan contents change often, so re-check the cited page before relying on a number.

## TL;DR

- **Only two candidates clear the EU hard requirement with a usable in-app inbox:** **Novu** (EU region in Frankfurt, available on *all* plans including Free) and **Courier** (EU datacenter in Ireland, **Business plan only**, pay per send with no free allowance).
- **Knock is out for now.** Its docs say "We expect to support EU data residency by the end of 2026"; today all its subprocessors, including AWS hosting, are listed as USA.
- **MagicBell is out.** It documents no hosting region and no EU option.
- **SuprSend is unclear.** Its security page claims "EU-data residency options", but its pricing lists custom data-centre regions only on Enterprise. Confirm with sales before considering it.
- **Engagespot looks dormant.** Its docs list an EU API host, but its marketing site returns HTTP 404 and its React packages were last published in May 2025.
- **Pingram (formerly NotificationAPI)** has a free EU region (Frankfurt), but in-app is a secondary channel and its in-app features are thinly documented. It's a fallback, not a lead.
- **Recommendation (for the follow-up grilling ticket to decide): Novu Cloud, EU region, Free plan.** Courier is the runner-up. Details and trade-offs are below.

## Comparison

| | **Novu** | **Courier** | **Knock** | **SuprSend** | **MagicBell** | **Engagespot** | **Pingram** |
|---|---|---|---|---|---|---|---|
| **EU hosting (hard req.)** | Yes. EU (Frankfurt), all plans [N1] | Yes. EU (Ireland), Business+ only [C1][C2] | **No.** "Expected by end of 2026" [K1] | Claimed but unspecified; custom regions Enterprise-only [S1][S2] | **Not documented** [M1][M2] | Yes, `api-eu.engagespot.co` [E1] | Yes. EU (Frankfurt), all plans [P1][P2] |
| **Free tier / small-scale cost** | Free: 10k workflow runs/mo, 2 envs, 30-day inbox retention [N2][N3] | No free EU tier. Business is $0.005/send "including the first 10,000" (2k sends = $10/mo) [C2] | Free: 10k msgs/mo (US only) [K2] | Free: 10k/mo, branded feed [S2] | Free: 1k deliveries/mo [M1] | Unverifiable (pricing page 404) | Free tier covers email/SMS/voice; in-app pricing not stated [P2] |
| **Live browser delivery, nothing self-hosted** | WebSocket, `wss://eu.socket.novu.co`; hooks realtime by default [N1][N4] | WebSocket (`realtime.eu.courier.io`) via `inbox.listenForUpdates()` [C1][C3] | (n/a: excluded) | Not verified | (n/a: excluded) | Not verified | Not verified |
| **React: prebuilt inbox** | `@novu/react` `<Inbox/>`, `<Bell/>`, `<Notifications/>` [N5] | `@trycourier/courier-react` `<CourierInbox/>`, popup, toast [C3] | (n/a) | `@suprsend/react` drop-in [S3] | (n/a) | `@engagespot/react-component` (stale) | `@notificationapi/react` popup [P3] |
| **React: headless hooks** | `useNotifications`, `useCounts`, etc. (plus `@novu/js`) [N4][N6] | `useCourier()` exposes feeds, unread count, actions [C3] | (n/a) | Headless option documented [S3] | (n/a) | `@engagespot/react-hooks` (stale) | `@notificationapi/core` headless [P3] |
| **Per-user auth signed by our server** | HMAC-SHA256 of subscriberId with secret key, passed as `subscriberHash`; "mandatory in production" [N7] | JWT minted by our backend via `POST /auth/issue-token` with scopes and `expires_in` [C4] | (n/a) | Signed JWT user tokens [S3] | (n/a) | Not verified | Not verified |
| **Node SDK / REST trigger** | `@novu/api` + REST [N8] | Node SDK + REST, EU `baseURL` [C1] | (n/a) | Yes | (n/a) | Yes | Node SDK, `region: 'eu'` [P1] |
| **Read/unread signal back to us** | Webhooks `message.seen/read/unread/archived/unarchived/snoozed` (svix-signed) **on Team+ only** [N9][N10]. On Free, use REST to list messages, counts, and status [N11] | `message:updated` webhook with `OPENED`, `CLICKED`; **no READ/ARCHIVED statuses documented** [C5] | (n/a) | No read/seen webhook documented [S4] | (n/a) | Not verified | No in-app events in events webhook [P3] |
| **Sandbox / dev mode** | Development + Production envs (2 on Free) [N2] | Test + Production envs [C6] | (n/a) | Separate workspaces [S4] | (n/a) | Not verified | Not verified |
| **Offline testability** | Best of the set: open-source community self-host via Docker could run locally/CI (caveats below) [N12] | None. SaaS only, so mock at our boundary | (n/a) | Self-host is Enterprise | (n/a) | None | None |
| **SDK activity (npm)** | `@novu/react` 3.19.2, 2026-09 | `@trycourier/courier-react` 9.3.5, 2026-11 | `@knocklabs/react` 0.15.1, 2026-11 | `@suprsend/react` 1.5.0, 2026-10 | `@magicbell/react` 1.14.0, 2026-07 | 3.0.1, **2025-05** | `@notificationapi/react` 2.0.1, 2026-10 |

"(n/a)" means the vendor failed the EU hard requirement, so I didn't verify that row further.

## Shortlist

### 1. Novu Cloud (EU region): recommended

- **EU:** Frankfurt, available on all plans. API `https://eu.api.novu.co/v1`, socket `wss://eu.socket.novu.co`, dashboard `eu.dashboard.novu.co`. The region is chosen at signup and API keys are region-bound (a wrong-region key gets a 401). Data can't be moved between regions later [N1].
- **Cost:** Free covers 10k workflow runs/month, 2 environments, 3 seats, 30-day inbox retention, and 1-day activity-feed (debug log) retention [N2][N3]. Pro starts at $30/month (90-day inbox retention, 7-day activity log). Outbound webhooks require **Team, from $250/month** [N2][N9].
- **Frontend:** `<Inbox />` drop-in plus headless hooks (`useNotifications` returns notifications plus `readAll`, `seenAll`, `archiveAll`, and per-notification `read`/`unread`/`archive`, with realtime over WebSocket by default) [N4][N5]. The `<Inbox>` props include `backendUrl` and `socketUrl` for pointing at the EU hosts [N5].
- **Auth:** Our server computes `HMAC-SHA256(subscriberId, NOVU_SECRET_KEY)` and hands it to the client as `subscriberHash`. This is not a JWT, so it has no expiry or scopes; it's a static per-user hash [N7].
- **Read state back to us:** Novu has the richest event set (`message.seen`, `.read`, `.unread`, `.archived`, `.unarchived`, `.snoozed`, `.deleted`) [N10], but webhooks are Team-only. On Free/Pro, the options are: (a) treat Novu as the source of truth for read state and query its REST API when needed [N11]; (b) have our own client call our server when it marks a notification read, which is easy with headless hooks but is client-reported; or (c) pay for Team.
- **Testing:** Development and Production environments come built in. HMAC is described as mandatory in production [N7]. The open-source community self-host (Docker Compose) could serve as a local or CI stand-in, with caveats: MongoDB, Redis, and LocalStack wiring, manual migrations, one team member, and some cloud features missing [N12]. Its API parity with Cloud's v2 Inbox would need checking before relying on it.

### 2. Courier (EU datacenter): runner-up

- **EU:** Ireland. Separate EU workspace with hosts `app.eu.courier.com`, `api.eu.courier.com`, `inbox.eu.courier.io`, and `realtime.eu.courier.io`. "All data in the two datacenters is separate" [C1].
- **Cost:** EU is only on **Business**, which costs $0.005 for every send including the first 10,000 (no free allowance) [C2]. At small scale that's cheap (1k sends = $5/month), but there's **no $0 EU option**, so even dev traffic in an EU workspace is billed.
- **Frontend:** `<CourierInbox />`, popup menu, and toast components, plus a `useCourier()` hook with feeds, unread count, and message actions. Realtime requires calling `inbox.listenForUpdates()` [C3].
- **Auth:** Real JWTs minted by our server (`POST https://api.eu.courier.com/auth/issue-token`, scopes `user_id:<id> inbox:read:messages inbox:write:events`, explicit `expires_in`). The SDK doesn't refresh tokens, so we re-mint and call `signIn` again [C4]. This is a cleaner model than Novu's static HMAC.
- **Read state back to us:** The weakest of the two. The `message:updated` webhook carries `OPENED` and `CLICKED`, but READ and ARCHIVED are not documented statuses [C5]. Expect to keep our own copy or have the client report reads.
- **Testing:** Test and Production environments [C6]. Nothing runs offline.

### Watch list (not shortlisted)

- **Knock:** It's the strongest product fit on paper (feeds, headless React, signed user tokens, message-status webhooks), but it has **no EU residency today**. Its docs say it's expected by end of 2026 [K1], and all subprocessors are USA [K3]. Re-evaluate if it ships before the decision.
- **SuprSend:** Ask sales whether EU residency is possible on Free/Essentials. The public docs contradict each other [S1][S2].
- **Pingram:** Free EU region, but in-app is a side channel and in-app read events aren't in its webhooks [P1][P3].
- **Excluded:** MagicBell (no EU) and Engagespot (site down, SDKs stale).

## Recommendation (to be decided in the grilling ticket)

**Novu Cloud, EU region, starting on Free.** It's the only candidate that meets the EU requirement at $0, ships both a drop-in `<Inbox/>` and headless hooks with built-in realtime, and offers a self-hostable open-source edition for offline testing. Its webhooks expose every read-state transition, but only from $250/month (Team). So the main question for the grilling ticket: **do we keep our own DB copy of read state?** Options:

1. Make Novu the source of truth on Free/Pro and use the REST API when the server needs read state.
2. Use headless hooks and have our client report reads to our server, keeping a copy in our DB.
3. Pay for Team to get signed webhooks.

Pick **Courier** instead if per-user tokens with expiry and scopes matter more than a free tier, and if `OPENED` (not read/archived) is enough signal back.

## Sources

- [N1] Novu, Security and Compliance (regions and endpoints): https://docs.novu.co/platform/additional-resources/security.md
- [N2] Novu pricing: https://novu.co/pricing
- [N3] Novu limits (inbox feed retention 30d Free / 90d Pro): https://docs.novu.co/platform/developer/limits
- [N4] Novu `useNotifications`: https://docs.novu.co/platform/sdks/react/hooks/use-notifications.md
- [N5] Novu React SDK reference: https://docs.novu.co/platform/sdks/react.md
- [N6] Novu headless (`@novu/js`): https://docs.novu.co/.mintlify/skills/inbox-integration/references/headless-inbox-examples.md
- [N7] Novu Inbox security (HMAC): https://docs.novu.co/.mintlify/skills/inbox-integration/references/security.md
- [N8] Novu Node trigger: https://docs.novu.co/.mintlify/skills/trigger-notification/references/installation.md
- [N9] Novu outbound webhooks (Team and Enterprise only, svix signatures): https://docs.novu.co/platform/developer/webhooks.md
- [N10] Novu webhook event types: https://docs.novu.co/platform/developer/webhooks/event-types.md
- [N11] Novu API reference index (messages, counts, mark read/seen/archive): https://docs.novu.co/_llms/api-reference.txt
- [N12] Novu self-hosted vs Cloud differences: https://docs.novu.co/community/project-differences and https://docs.novu.co/community/self-hosting-novu/deploy-with-docker
- [C1] Courier EU datacenter: https://www.courier.com/docs/platform/workspaces/eu-datacenter.md
- [C2] Courier pricing: https://www.courier.com/pricing
- [C3] Courier React SDK: https://www.courier.com/docs/sdk-libraries/courier-react-web.md
- [C4] Courier Inbox authentication: https://www.courier.com/docs/in-app/authenticate-users.md
- [C5] Courier webhook events: https://www.courier.com/docs/monitor/webhooks/events.md
- [C6] Courier go-live (Test to Production): https://www.courier.com/docs/guides/go-live.md
- [K1] Knock plans ("We expect to support EU data residency by the end of 2026"): https://docs.knock.app/manage-your-account/knock-plans.md (same callout on https://docs.knock.app/developer-tools/security.md)
- [K2] Knock pricing: https://knock.app/pricing
- [K3] Knock subprocessors (AWS, USA): https://knock.app/legal/subprocessors
- [S1] SuprSend security ("We support EU-data residency options"): https://docs.suprsend.com/docs/security
- [S2] SuprSend pricing (custom data-centre regions: Enterprise): https://www.suprsend.com/pricing
- [S3] SuprSend React inbox (`@suprsend/react`, JWT auth): https://docs.suprsend.com/docs/react-inbox-integration.md
- [S4] SuprSend docs index: https://docs.suprsend.com/llms.txt
- [M1] MagicBell pricing (no residency mention): https://www.magicbell.com/pricing
- [M2] MagicBell security (no region stated): https://www.magicbell.com/security
- [E1] Engagespot data region: https://docs.engagespot.co/docs/concepts/data-region (`engagespot.co` itself returned HTTP 404 on 2026-11-14)
- [P1] Pingram EU region announcement: https://www.pingram.io/blog/introducing-notificationapi-s-european-data-center
- [P2] Pingram pricing: https://www.pingram.io/pricing
- [P3] Pingram in-app and events webhook docs: https://www.pingram.io/docs/channels/inapp and https://www.pingram.io/docs/features/events-webhook (in-app page returned 404 when fetched directly; details from search snippets, so lower confidence)
- npm publish data: `npm view <pkg> version time.modified`, run 2026-11-14.
- Secondary (competitor-authored, used only as leads): https://www.courier.com/blog/eu-data-residency-notifications
