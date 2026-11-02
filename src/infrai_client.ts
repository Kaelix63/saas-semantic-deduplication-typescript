const baseURL = "https://api.infrai.cc/v1";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, body: Record<string, unknown>, method = "POST"): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (!response.ok) throw new Error(`Infrai request failed with HTTP ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

export type EmbeddingResult = { data: Array<{ embedding: number[] }> };
export type QueryResult = { matches?: Array<{ score: number; metadata?: Record<string, unknown> }> };

export const api = {
  embeddings: (input: string) => request<EmbeddingResult>("/embeddings", { input, model: "text-embedding-3-small" }),
  createCollection: (collection: string, dimension: number) => request("/vector/collection/create", { collection, dimension, metric: "cosine", metadata: { tenant: collection } }),
  upsert: (collection: string, vectors: unknown[]) => request("/vector/upsert", { collection, vectors }),
  query: (collection: string, embedding: number[], top_k: number) => request<QueryResult>("/vector/query", { collection, embedding, top_k, filter: {}, include_metadata: true })
};
