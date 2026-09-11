import { dev } from "astro";

// Playwright owns this foreground process. Astro's CLI may auto-background in
// coding-agent environments, which escapes webServer's lifetime and isolation.
const server = await dev({ server: { host: "127.0.0.1", port: 4322 } });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop();
  process.exit(0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
