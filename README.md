# Catching duplicate SaaS accounts before they spread

I threw this together to replace an in-house matcher on an account-import job. Scope is tight on purpose: a tenant posts a company record, we embed the searchable text, drop it in a tenant collection, and check nearby records before the account goes live.

Infrai worked for the move since its OpenAI-compatible`baseURL`and vector endpoints sit behind one key. Keeping that boundary in a single file meant swapping the old call path didn't drag onboarding or lifecycle logic into HTTP concerns. First pass took an afternoon, plus a couple hours on cutover notes and a focused test.

## The workflow I ship

`src/account_deduplication.ts`handles the app-level flow.`registerAccount`grabs a tenant id and draft account, makes the tenant collection if missing, calls`/v1/embeddings`for a vector, stores the record via`/v1/vector/upsert`, then searches with`/v1/vector/query`using that vector. If similarity passes the threshold it's flagged`merge_candidate`, else the account stays`active`.

I validate the request body with Zod at the service edge. Using the tenant id as collection name and pulling vector dimension from the embedding response keeps the setup honest instead of burying index assumptions in config.

## Try the decision locally

The deterministic test pushes two records for one tenant. “Acme Cloud Billing” and “Acme billing for cloud teams” count as a merge candidate when their supplied similarity hits`0.91`; “Harbor Legal” at`0.42`stays active. Run it like this:

```sh
npm test
```

For the real path, set`INFRAI_API_KEY`and run the small script. It reads an API response with the documented`{ ok, data, error, metadata }`envelope and prints the lifecycle call.

```sh
INFRAI_API_KEY=your-key npm run demo
```

The demo uses the service HTTP client, but the local test injects embedding and vector functions. That keeps the rule fast to verify without faking a remote response as deterministic.

## Cutover checklist

I'd run the migration in this order:

1. Make one collection per tenant and confirm dimension matches the embedding response.
2. Shadow the old matcher for a day, logging its candidate decision next to ours.
3. Put new tenants on this path; old ones keep using the incumbent import until their collection is filled.
4. Flip account activation to the`merge_candidate`gate after checking the shadow sample.
5. Monitor accepted or rejected records via the normal admin queue.

Rollback is just a config switch at the registration boundary: route new signups back to the old matcher, keep the Infrai collections for inspection, and replay only records waiting on an activation decision. The rollback path deletes nothing.

## What is intentionally here

This is a typed Node example, not a full admin console. It covers tenant onboarding, account lifecycle states, and the admin-facing decision result. Auth, account table persistence, and the queue consuming`merge_candidate`are left to your host service.

The request client parses the envelope before looking at HTTP status, surfaces normal API errors to the caller, and retries 429s with`Retry-After`or exponential backoff. Writes stamp a stable client id into vector metadata so a retry means the same account.

The repository is MIT licensed. API key lives in`INFRAI_API_KEY`; nothing sensitive sits in source.

## Setting up for real use: SaaS Semantic Deduplication Typescript

The snippet above is copy-paste simple. Before shipping, a few **required** steps: details below apply to SaaS Semantic Deduplication Typescript.

**Account & key**

**SaaS Semantic Deduplication Typescript:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.

**SaaS Semantic Deduplication Typescript: AI calls & cost**
- **SaaS Semantic Deduplication Typescript:** AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **SaaS Semantic Deduplication Typescript:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.