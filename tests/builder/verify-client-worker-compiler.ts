// Exercise the worker's Vite SSR loader outside Vitest and outside the Astro dev server.
import { createClientCompiler } from "../../scripts/builder-client-worker";
import { randomUUID } from "node:crypto";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";
import { savePage } from "../../shared/visualBuilder";
import { captureClientPublication } from "../../shared/builderClientPublication";
const compiler = await createClientCompiler();
try {
  const document = newDocument("Worker renderer verification", "about", false),
    text = starterBlocks.Text();
  text.props.text = "Trusted worker renderer loaded outside Astro";
  document.data.content = [text];
  const snapshot = captureClientPublication(randomUUID(), {
    pages: [savePage([], document, randomUUID(), 0)],
    assets: [],
    saved: [],
  });
  const compiled = await compiler.compile(
    snapshot,
    async () => {
      throw new Error("Unexpected network asset request");
    },
    () => {},
  );
  if (
    !new TextDecoder()
      .decode(compiled.files["about/index.html"])
      .includes(text.props.text) ||
    !compiled.backup.length
  )
    throw new Error("Worker renderer output or editable backup is missing.");
  process.stdout.write(
    `Verified standalone worker loader: ${Object.keys(compiled.files).length} static files and an editable backup.\n`,
  );
} finally {
  await compiler.close();
}
