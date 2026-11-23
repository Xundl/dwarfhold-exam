// talks to the server (only place with fetch), turns every problem into an error with readable text
// types only
import type { ExpeditionResult } from "./types";

// after 10 seconds without answer expedition counts as failed (d4), 10_000 = 10000 ms
export const EXPEDITION_TIMEOUT_MS = 10_000;

// asks server to run expedition, async = waits for network, returns result or throws error
export async function beginExpedition(dwarfId: string, destination: string): Promise<ExpeditionResult> {
  // answer of server
  let response: Response;
  // try = catch network problems
  try {
    // post request to api (vite dev server passes /api on to express, port 4200)
    response = await fetch("/api/expeditions", {
      // post = create something
      method: "POST",
      // body is json
      headers: { "Content-Type": "application/json" },
      // who and where, as json text
      body: JSON.stringify({ dwarfId, destination }),
      // abort request automatically after timeout
      signal: AbortSignal.timeout(EXPEDITION_TIMEOUT_MS),
    });
  // request itself failed
  } catch (error) {
    // it was the timeout
    if (error instanceof DOMException && error.name === "TimeoutError") {
      // readable text for chronicle
      throw new Error("No word came back from the expedition. The scout turned home empty-handed.");
    }
    // everything else = server not reachable
    throw new Error("The gate road is unreachable. The scout returned without setting out.");
  }

  // read body as json, body may not be json at all (server down behind proxy), then null instead of crash
  const body = await response.json().catch(() => null);

  // http status not 2xx (blocked pass answers with error)
  if (!response.ok) {
    // use error text from server if there is one, otherwise status code
    throw new Error(body?.error ?? `Expedition failed (${response.status}).`);
  }
  // check shape before trusting it: id and message must be text, rewards an object
  if (!body || typeof body.expeditionId !== "string" || typeof body.message !== "string" || typeof body.rewards !== "object") {
    // unreadable answer = failure, no rewards
    throw new Error("The scout's report was unreadable. No rewards were counted.");
  }
  // checked, now treat as expedition result
  return body as ExpeditionResult;
}