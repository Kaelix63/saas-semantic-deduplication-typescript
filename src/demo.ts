import { registerAccount } from "./account_deduplication.ts";

const result = await registerAccount("acme-demo", {
  externalId: "acct-100",
  name: "Acme Cloud Billing",
  description: "Invoices and usage billing for cloud teams"
});
console.log(JSON.stringify(result, null, 2));
