import { readFile, writeFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
// Synthetic SVGs and the site's existing logo exercise a mixed asset pack without third-party UI8 files.
const starterLicence = await readFile(
  "client/visual-builder/sample-illustrations-licence.txt",
);
await writeFile(
  "public/builder-samples/LICENCE-Kaizen-illustrations.txt",
  starterLicence,
);
const files = {
  "images/landscape.svg": await readFile(
    "public/builder-samples/landscape.svg",
  ),
  "icons/spark.svg": await readFile("public/builder-samples/spark.svg"),
  "images/kaizen-logo.png": await readFile(
    "public/kaizenweb-logo-light-mode-260x50.png",
  ),
  "fonts/Inter.ttf": await readFile("public/builder-samples/fonts/Inter.ttf"),
  "licences/LICENCE-Inter.txt": await readFile(
    "public/builder-samples/fonts/LICENCE-Inter.txt",
  ),
  "components/ExampleCard.tsx": strToU8(
    "export function ExampleCard(){return <article>Review this code before integration.</article>}",
  ),
  "designs/example.fig": strToU8(
    "DEMO PLACEHOLDER — not a real Figma file. Tests design-file classification only.",
  ),
  "licences/LICENCE.txt": strToU8(
    "The landscape and spark SVGs are original Kaizen builder demonstration assets. You may use them in your Kaizen pages. The Kaizen logo belongs to the site owner. The .fig is a classification placeholder, not a usable design. No UI8 asset compatibility is claimed by this fixture.",
  ),
};
await writeFile("public/builder-samples/sample-pack.zip", zipSync(files));
console.log(
  "Created representative mixed sample pack (8 files, including an OFL font).",
);
await writeFile(
  "public/builder-samples/starter-illustrations.zip",
  zipSync({
    "images/landscape.svg": files["images/landscape.svg"],
    "icons/spark.svg": files["icons/spark.svg"],
    "licences/LICENCE-Kaizen-illustrations.txt": starterLicence,
  }),
);
console.log(
  "Created starter illustrations pack (two original SVGs and their licence).",
);
