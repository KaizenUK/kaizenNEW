import { dev } from "astro";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { port: { type: "string", default: "4321" } },
});
const port = Number(values.port);
if (
  !/^\d+$/.test(values.port) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
)
  throw new Error("Use --port followed by a port number between 1 and 65535.");

// Match the hosted companion's IPv4 address on Windows as well as Unix.
// The CLI can resolve localhost to IPv6 or detach in agent environments.
// This API keeps the server in this terminal and refuses a silent port change.
const server = await dev({
  server: { host: "127.0.0.1", port },
  vite: { server: { strictPort: true } },
});
console.log(
  `Local companion: http://127.0.0.1:${port} — keep this terminal running; Ctrl+C stops it.`,
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop();
  process.exit(0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
