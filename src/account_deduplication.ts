import { z } from "zod";
import { api } from "./infrai_client.ts";

const accountDraft = z.object({
  externalId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().min(2)
});
export type AccountDraft = z.infer<typeof accountDraft>;
export type Lifecycle = "active" | "merge_candidate";
export type AccountDecision = { tenantId: string; externalId: string; lifecycle: Lifecycle; matchedExternalId?: string; score?: number };

export async function registerAccount(tenantId: string, raw: unknown): Promise<AccountDecision> {
  const account = accountDraft.parse(raw);
  const collection = `tenant-${tenantId}`;
  const embeddingResult = await api.embeddings(`${account.name}: ${account.description}`);
  const embedding = embeddingResult.data[0]?.embedding;
  if (!embedding) throw new Error("Embedding response did not contain a vector");
  await api.createCollection(collection, embedding.length);
  const matches = await api.query(collection, embedding, 3);
  const best = matches.matches?.[0];
  await api.upsert(collection, [{ id: account.externalId, values: embedding, metadata: { tenantId, externalId: account.externalId, name: account.name } }]);
  if (best && best.score >= 0.88) return { tenantId, externalId: account.externalId, lifecycle: "merge_candidate", matchedExternalId: String(best.metadata?.externalId ?? ""), score: best.score };
  return { tenantId, externalId: account.externalId, lifecycle: "active" };
}

export function decideLifecycle(score: number, matchedExternalId: string, tenantId: string, externalId: string): AccountDecision {
  return score >= 0.88
    ? { tenantId, externalId, lifecycle: "merge_candidate", matchedExternalId, score }
    : { tenantId, externalId, lifecycle: "active" };
}
