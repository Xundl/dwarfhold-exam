// small express server (api): only delivers expedition results, knows nothing about the colony and remembers no running expeditions
// cors = allows requests coming from another address (browser dev server)
import cors from "cors";
// express = web server library
import express from "express";

// create server
const app = express();
// port from environment or 4200
const port = Number(process.env.PORT ?? 4200);
// counter for expedition ids (starts again after server restart, so not usable as lasting id)
let expeditionNumber = 16;

// results per destination (rewards and story text)
const outcomes = {
  // crystal cave: stone and a tool (elf joins after first success, decided by client)
  "crystal-cave": { rewards: { stone: 8, tools: 1 }, message: "The scout found a crystal seam and an abandoned mason's tool." },
  // old mine: stone and wood
  "old-mine": { rewards: { stone: 12, wood: 2 }, message: "The old mine still holds good stone and usable supports." },
  // goblin warren (d7): wood and food, success makes goblins follow scout home, client decides the attack (server does not know the weapons)
  "goblin-warren": { rewards: { wood: 10, food: 6 }, message: "The scout slipped out of the goblin warren with timber and stolen rations. Something is following." },
};

// allow requests from other origin, read json bodies
app.use(cors()); app.use(express.json());

// health check: is server alive
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "dwarfhold" }));

// run an expedition
app.post("/api/expeditions", (req, res) => {
  // simulated delay in ms (from ?latency= or environment, default 2000), kept between 0 and 5000
  const latency = Math.max(0, Math.min(5000, Number(req.query.latency ?? process.env.API_LATENCY ?? 2000)));

  // answer only after delay
  setTimeout(() => {
    // who and where from body ({} if body is missing)
    const { dwarfId, destination } = req.body ?? {};

    // both must be text
    if (typeof dwarfId !== "string" || typeof destination !== "string") {
      // 400 = bad request
      return res.status(400).json({ error: "dwarfId and destination are required" });
    }
    // built in failure: ?fail=true or destination blocked pass
    if (req.query.fail === "true" || destination === "blocked-pass") {
      // 503 = not available
      return res.status(503).json({ error: "Rockfall has sealed the route. The company heard no signal." });
    }
    
    // look up result
    const outcome = outcomes[destination];
    
    // unknown destination = 404
    if (!outcome) return res.status(404).json({ error: "That destination is not on the hold map" });
    
    // next id number
    expeditionNumber += 1;
    
    // answer: id, status completed, rewards and text
    res.json({ expeditionId: `exp-${expeditionNumber}`, status: "completed", ...outcome });
  // wait this long
  }, latency);
});

// start listening
app.listen(port, () => console.log(`Dwarfhold API listening on http://localhost:${port}`));
