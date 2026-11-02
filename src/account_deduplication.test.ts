import assert from "node:assert/strict";
import { decideLifecycle } from "./account_deduplication.ts";

const duplicate = decideLifecycle(0.91, "acct-acme-old", "tenant-7", "acct-acme-new");
assert.equal(duplicate.lifecycle, "merge_candidate");
assert.equal(duplicate.matchedExternalId, "acct-acme-old");

const distinct = decideLifecycle(0.42, "acct-harbor", "tenant-7", "acct-new");
assert.equal(distinct.lifecycle, "active");
assert.equal(distinct.matchedExternalId, undefined);
console.log("account lifecycle decisions pass");
