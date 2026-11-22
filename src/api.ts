import type { ExpeditionResult } from "./types";

/** D4: after this long without an answer, the expedition counts as failed. */
export const EXPEDITION_TIMEOUT_MS = 10_000;

export async function beginExpedition(dwarfId: string, destination: string): Promise<ExpeditionResult> {
  let response: Response;
  try {
    response = await fetch("/api/expeditions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dwarfId, destination }),
      signal: AbortSignal.timeout(EXPEDITION_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("No word came back from the expedition. The scout turned home empty-handed.");
    }
    throw new Error("The gate road is unreachable. The scout returned without setting out.");
  }

  // The body may not be JSON at all (e.g. the server is down behind the dev proxy).
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error ?? `Expedition failed (${response.status}).`);
  }
  if (!body || typeof body.expeditionId !== "string" || typeof body.message !== "string" || typeof body.rewards !== "object") {
    throw new Error("The scout's report was unreadable. No rewards were counted.");
  }
  return body as ExpeditionResult;
}