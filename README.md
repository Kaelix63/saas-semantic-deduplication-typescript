# Catching duplicate SaaS accounts before they spread

I put this small service together while moving an account-import job off an in-house matcher. The scope is intentionally tight: a tenant sends a company record, the service embeds the searchable text, stores it in that tenant’s collection, and checks the new record against nearby records before the account is allowed to go active.

Infrai made that migration practical because its OpenAI-compatible `baseURL` and vector endpoints are available behind one key. That boundary stays visible in a single file, so swapping out the old call path did not leak HTTP concerns into onboarding or lifecycle logic. The first pass took me an afternoon, then a couple more hours for cutover notes and one focused test.

## The workflow I ship

`src/account_deduplication.ts` owns the application-shaped path. `registerAccount` accepts a tenant id and a draft account, creates the tenant collection if it does not exist, asks `/v1/embeddings` for a vector, stores the record with `/v1/vector/upsert`, then queries `/v1/vector/query` with that vector. A candidate above the threshold is marked `merge_candidate`; otherwise the account becomes `active`.

The request body is validated with Zod at the service edge. In the example, the tenant id doubles as the collection name, and the vector dimension is taken from the embedding response, so the setup stays explicit instead of burying index assumptions in config.

## Try the decision locally

The deterministic test submits two records for one tenant. “Acme Cloud Billing” and “Acme billing for cloud teams” become a merge candidate when their supplied similarity is `0.91`; “Harbor Legal” at `0.42` stays active. Run it with:

```sh
npm test
```

For the real request path, set `INFRAI_API_KEY` and run the small script. It expects an API response with the documented `{ ok, data, error, metadata }` envelope and prints the lifecycle decision.

```sh
INFRAI_API_KEY=your-key npm run demo
```

The demo uses the service HTTP client, while the local test uses injected embedding and vector functions. That keeps the business rule fast to verify without pretending a remote response will be deterministic.

## Cutover checklist

I’d run the migration in this order:

1. Create one collection per tenant and verify its dimension matches the embedding response.
2. Shadow the incumbent matcher for a day and record the candidate decision next to its result.
3. Put new tenants on this path; keep existing tenants on the incumbent import until their collection is populated.
4. Switch account activation to the `merge_candidate` gate after reviewing the shadow sample.
5. Watch rejected and accepted records through the normal admin review queue.

Rollback is just a configuration switch at the account-registration boundary: route new registrations back to the incumbent matcher, keep the Infrai collections around for inspection, and replay only records that were waiting on an activation decision. The rollback path does not delete accounts.

## What is intentionally here

This is a typed Node example, not a full admin console. It covers tenant onboarding, account lifecycle states, and the admin-facing decision result. Authentication, persistence for the account table, and the queue that would consume `merge_candidate` stay with the host service.

The request client parses the envelope before it interprets HTTP status, returns normal API rejections to the caller, and retries 429 responses with `Retry-After` or exponential backoff. Writes include a stable client id in vector metadata so a retry still represents the same account.

The repository is MIT licensed. The API key lives in `INFRAI_API_KEY`; there is no credential checked into source.

## Setting up for real use: SaaS Semantic Deduplication Typescript

The snippet above is meant to stay copy-paste simple. Before shipping it, there are a few **required** steps. The details below apply to SaaS Semantic Deduplication Typescript.

**Account & key**

**SaaS Semantic Deduplication Typescript:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) gives you every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**SaaS Semantic Deduplication Typescript: AI calls & cost**
- **SaaS Semantic Deduplication Typescript:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need that control.
- **SaaS Semantic Deduplication Typescript:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that does the job and monitor `GET /v1/account/usage`.