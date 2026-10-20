# Remaining Resource Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete #6 with strict remaining-resource inputs and supported queries.
**Architecture:** Shared raw-shape maps and pure account request validation feed
strict MCP tools and SDK preparation. Native adapters retain flat-query convention
and existing transport while tightening input checks.
**Tech Stack:** Existing TypeScript/Zod 3/pinned Ghost and MCP SDKs/Node 22 tests.
**Spec:** `docs/superpowers/specs/2026-10-21-remaining-schemas-design.md`

## Global Constraints
- All 46 names, `{data, meta?}`, delete confirmations, settings and HTTP/auth/retry policies stay unchanged.
- No dependency/lock/license changes, private wrapper, live Ghost/email/Stripe actions, merge or deployment.
- Approach approved; native execution and one independent final review; push/PR authorized without further approval pauses.
- Ghost v5.130.0 source baseline, v5.0 minimum header; no live compatibility claim.
- No arbitrary proxy; send/cancel/opt-in controls and newsletter delete capability stay #7.

## Review Focus
1. Email selectors containing +/% encode once while edited email remains original body text (Tasks 1/2).
2. Separate SDK options null/array/primitives/duplicates fail, false/null/[] in valid writes survive, and caller objects remain unchanged (Tasks 1/2).
3. Strict nested refs reject unknown keys through MCP and direct callers, not only helpers; malformed selectors never dispatch even to injected clients (Tasks 1/2).
4. Native `include` and paging controls are endpoint-specific; removed tier include fails and tier server-side pagination limitations are documented (Tasks 1/3).
5. Discovery lists 46 strict schemas, not a live-support claim for newsletters_delete; output/envelopes/errors/auth remain unchanged (Tasks 2/3).

## Task 1: Source-backed schema/preparation and native audit
**Files:** create `src/schemas/accounts.ts`, `src/client/accountRequest.ts`,
`test/account-inputs.test.cjs`; modify `src/schemas/{tiers,offers,staff}.ts`,
`src/client/{commerceClient,staffClient}.ts` and existing native schema tests.
**Interfaces:** accounts.ts exports `accountShapes`, `accountQueryShapes` keyed
members/users/newsletters/webhooks, operation raw shapes from exact spec matrix;
`validateAccountInput(resource,operation,input,options?)` returns merged validated
unencoded Record. `prepareAccountRequest(resource,operation,input,options?)` returns
`{input:Record<string,unknown>,query:QueryOptions}` with body/query splitting and
SDK selector encoding. Browse input stays SDK query object. Unknown resource/
operation types closed; no change to content preparer. Native options convention
stays flat; only undefined or strict empty options object accepted.
- [ ] Write helper tests for exact query matrix, operation-specific unsupported
  keys, absent/multiple selectors, nested refs, all paging, enums and nullable
  fields. Assert literal email encoding `name%2Btag%25box%40example.invalid`.
- [ ] Write immutability and duplicate/null/array/primitive options tests;
  direct write null/false/[] retained; safe selectors reject traversal/control.
- [ ] Run tests for RED missing module; implement maps/preparation with no coercion.
- [ ] Write native regressions before modifying native schemas: tier includes
  rejected; unsafe integers/blank queries, offer enums/ranges, null/array options
  rejected without requests. Observe RED; implement exact spec constraints.
- [ ] Update intentional native include fixtures while retaining literal
  authentication/body assertions; run typecheck/full tests/diff check; commit.

## Task 2: Strict MCP and SDK integration
**Files:** modify `src/tools/{members,users,newsletters,webhooks}.ts`,
`src/client/sdkAdapter.ts`; create `src/tools/registerAccountTools.ts`,
`test/account-mcp.test.cjs`; update types/imports and old stripping tests.
**Interfaces:** reuse Task 1 raw shapes for tool exports/ToolInputs; shared
registerAccountTools registers exact existing names, strict parses and calls
validateAccountInput before injected clients. Use a pure split function or
unencoded preparation option to pass query separately without double encoding;
SDK adapter alone encodes path segments. Preserve delete text and JSON envelope.
- [ ] Real MCP RED tests for per-resource browse/read/write query forwarding,
  email/id/slug paths, explicit null clearing and booleans/arrays retained.
- [ ] Tests for all newly repaired tools unknown-key failure; injected fake
  client proves ambiguous selector never invoked; direct clients reject bypass,
  wrong-operation/duplicate options and invalid nested refs without requests.
- [ ] Observe RED old stripping/forwarding; integrate registration and SDK
  validation. Preserve non-Account dispatch/content response capture and errors.
- [ ] Type contracts valid options/nulls; invalid newsletter status/enum, tag
  regression, member null, native include fail compile; import safety new files.
- [ ] Update intentional obsolete fixtures, run typecheck/full tests/diff check;
  commit integration.

## Task 3: Wire/discovery/docs, review, push/PR
**Files:** extend `test/native-http.test.cjs`, `test/stdio.test.cjs`, `README.md`;
record final verification/review here.
- [ ] HTTP assertions for plus/percent email paths, native fields queries,
  SDK include/query/body split and clearing; assert original headers/envelopes,
  no requests for malformed input. Watch tests before any needed product fixes.
- [ ] Actual stdio paginated discovery asserts all 46 strict schemas, correct
  account query properties and no new outputSchema or network side effects.
- [ ] README exact remaining-resource matrix, native flat convention, all
  limits, tier include removal/server pagination caveat, #7 capability exclusion.
- [ ] Check all #6 acceptance criteria against both slices and state closure
  scope; no full API/live-support claim. Clean npm ci/typecheck/full tests/diff.
- [ ] One independent whole-branch read-only reviewer (base origin/main to HEAD),
  spec/plan/Review Focus plus declined-to-judge list. Fix findings test-first;
  record explicit scope rulings, no per-task review or automatic merge.
- [ ] Final verification/clean status; find PR templates, push feature branch,
  create PR with `Closes #6` only if verified criteria complete; watch both CI.

## Self-review
Schema/nullable/query/selector rules map to Task 1, both validation boundaries to
Task 2, wire/discovery/migration/closure to Task 3. Five Review Focus classes have
tests assigned above. Native signatures stay flat; SDK preparer returns same
shape contract as content preparer but selector encoding occurs only in adapter.
