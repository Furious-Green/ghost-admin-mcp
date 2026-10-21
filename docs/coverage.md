# Coverage, versions and credentials

This is an **offline contract/source coverage matrix**, not a live compatibility
certification. Every row below is exercised without real Ghost credentials.
Ghost remains authoritative for authorization, validation and side effects.

## Evidence and version boundaries

| Layer | Verified baseline | Evidence / limit |
| --- | --- | --- |
| Ghost source | 5.130.0 | Endpoint schemas, services/models and middleware; not a running instance |
| Ghost Admin SDK | 1.13.13 in package-lock.json | Real SDK with recording transport and Axios loopback parity; not every available SDK release |
| API header | default `v5.0` | Minimum-version request header, not a pinned server or every-5.x guarantee |
| MCP SDK | 1.32.1 | In-memory and executable stdio tests, strict discovery/dispatch; specification-based ordinary tool errors |
| Toolchain | Node 22; local 22.22.1 / npm 9.2.0 on Linux | CI selects Node 22; each artifact records actual versions; not all platforms/toolchains |
| Live Ghost / hosted plans / mail / billing | **Not verified** | No production requests, email delivery, Stripe or theme activation used to establish coverage |

## Exposed operations and transport

“Integration route allowed” means the baseline route/method gate permits it,
**not** that any integration key may perform it. Fixed integration permissions,
staff role/object permissions and service/hosting restrictions still apply.
Staff credentials use the same configured `id:secret` setting; this server neither
creates staff tokens nor converts/escalates integration keys.

| Resource | Exposed tool operations | Transport | Integration route gate / staff distinction |
| --- | --- | --- | --- |
| Posts | browse/read/add/edit/delete, copy | SDK CRUD; native copy | GET/POST/PUT/DELETE allowed; content ownership and email delivery permissions still enforced |
| Pages | browse/read/add/edit/delete, copy | SDK CRUD; native copy | GET/POST/PUT/DELETE allowed; copying creates a draft through Ghost |
| Tags | browse/read/add/edit/delete | SDK | GET/POST/PUT/DELETE allowed |
| Members | browse/read/add/edit/delete | SDK | GET/POST/PUT/DELETE allowed; private data and subscription/billing effects need appropriate permissions |
| Users | browse/read/edit/delete | SDK | **GET only** for integration keys; edit/delete require suitable staff context |
| Newsletters | browse/read/add/edit | SDK | GET/POST/PUT allowed; no delete endpoint; creation opt-in and address verification can have real effects |
| Webhooks | add/edit/delete | SDK | POST/PUT/DELETE allowed; no browse/read tool; target delivery is not live-tested |
| Tiers | browse/read/add/edit | Fixed native routes | GET/POST/PUT allowed; explicit active:false archival, not deletion; billing constraints apply |
| Offers | browse/read/add/edit | Fixed native routes | GET/POST/PUT allowed; explicit archival, no deletion; billing constraints apply |
| Invites | browse/add/delete | Fixed native routes | **POST only** for integration keys; browse/delete require suitable staff context; add sends real invitation email |
| Roles | browse (`permissions:assign` optional) | Fixed native route | GET allowed; assignment filtering checks credential/role permissions; no role read/write tool |
| Member labels | browse/read/add/edit/delete | Fixed native routes | GET/POST/PUT/DELETE allowed; deleting labels is not deleting members |
| Site | read | Native public GET | Unauthenticated endpoint; public site metadata, not general settings; CLI still requires its existing configuration |
| Images | upload | Fixed native multipart | POST allowed subject to permissions; bounded base64 JPEG/PNG/GIF/WebP, 5 MiB |
| Themes | upload, activate | Fixed native multipart / PUT | POST/PUT allowed subject to permissions/hosting; separate activation, bounded 10 MiB ZIP metadata inspection |

Total: **54 tools**, with 31 SDK-backed operations and 23 fixed-route native
operations. No generic HTTP proxy. **Eight delete tools** retain plain-text
confirmations: posts, pages, tags, members, users, webhooks, invites and labels.
Data operations return `{data, meta?}` inside MCP text; browse data is an array,
entity data an object. Pagination is explicit and never automatically fetched.

Six JSON resource templates read posts, members, users, tiers, offers and
newsletters by ID; `blog://info` reads public site metadata. They reuse the same
client and permissions, not a privileged alternate path. One `summarize-post`
prompt accepts `postId`, reads explicit HTML and supplies bounded, labeled,
untrusted source text; it neither executes an LLM nor bypasses content access.

### Permission evidence

Baseline source, pinned to the tag rather than a moving branch:

- [Admin route/method integration allowlist and staff-token blocklist](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/web/api/endpoints/admin/middleware.js).
- [Endpoint permission processing](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/api/endpoints/utils/permissions.js).
- [Role assignment filtering](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/models/role.js): API-key handling exists; Owner assignment is excluded. This is not a role-granting bypass.
- [Roles endpoint](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/api/endpoints/roles.js) and [invites endpoint](https://github.com/TryGhost/Ghost/blob/v5.130.0/ghost/core/core/server/api/endpoints/invites.js).

These gates must be read together. A permissive model fixture does not override
an endpoint/method restriction. Conversely, roles and invite creation are **not
categorically staff-token-only** just because they manage staff-related data.
No universal integration/staff credential compatibility is claimed.

## Known gaps and operational cautions

- Not full Ghost Admin API or Admin UI parity: no generic settings/configuration,
  media/file upload, database import/export, comments, ownership transfer, session
  administration or arbitrary/internal endpoints. No undeclared-field passthrough.
- No newsletter/offer/tier delete or role-read emulation; removed names have no
  aliases or automatic archival. No user-add tool. Exposed fields/query options
  are deliberately narrower than all database/internal fields.
- Tier paging/order/projection controls are accepted at the baseline endpoint
  but the service returns synthetic one-page metadata; forwarding is not a claim
  that the service applies those controls. Offers/roles are unpaginated.
- Source-verified schema support does not guarantee a state transition, mail
  delivery, subscription change or permission on a particular server/version.
- Theme upload **can overwrite/reload active theme files immediately**; it is
  not harmless staging. ZIP checks inspect metadata, not full extraction or
  actual expansion safety. Activation changes the public site separately.
- Native requests refuse redirects, time out and never retry; SDK transport has
  separate inherited policy. Never blindly repeat a timed-out mutation.
- No automatic email send, recipient inference, billing action or live smoke
  mutation is performed during tests/artifact verification.
- From fork0.2.0, known-tool validation/budget and execution failures are `isError`
  results; unknown/disabled names and malformed envelopes remain protocol errors.
  [Migration and retained dispatcher rationale](tool-errors.md) distinguish the
  specification from SDK defaults, including the experimental-task limitation.

See [README migrations](../README.md#migrating-from-the-original-implementation),
[artifact adoption/rollback](artifacts.md) and [dated dependency evidence](dependency-security.md).
