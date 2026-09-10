import {
  clone,
  savePage,
  type Asset,
  type Workspace,
} from "../../shared/visualBuilder";
import {
  initialSiteDesign,
  publishSiteWorkspace,
  saveSiteDesign,
} from "../../shared/builderSite";
import { newDocument, starterBlocks } from "./starters";

export function libraryFixture(): Workspace {
  const assets: Asset[] = ["original", "replacement"].map((name) => ({
    id: crypto.randomUUID(),
    name: `${name}.png`,
    path: `images/${name}.png`,
    pack: "Source pack",
    kind: "image",
    mime: "image/png",
    size: 100,
    url: `/builder-media/${name}.png`,
    hash: (name === "original" ? "a" : "b").repeat(64),
    tags: [],
    favourite: false,
    createdAt: "2026-09-10T00:00:00.000Z",
  }));
  const image = starterBlocks.Image();
  image.props.src = assets[0].url;
  const design = initialSiteDesign();
  design.components = [
    {
      id: "library-header",
      name: "Library header",
      kind: "header",
      blocks: [clone(image)],
    },
  ];
  const workspace: Workspace = {
    assets,
    site: saveSiteDesign(undefined, 0, design),
    saved: [
      {
        id: crypto.randomUUID(),
        name: "Saved gallery",
        kind: "section",
        blocks: [clone(image)],
      },
    ],
    pages: ["one", "two", "three"].map((slug, index) => {
      const document = newDocument(`Library ${slug}`, `library-${slug}`, false);
      document.site = { useTheme: true, headerId: "library-header" };
      document.data.content = index === 2 ? [] : [clone(image)];
      return savePage([], document, crypto.randomUUID(), 0);
    }),
  };
  return publishSiteWorkspace(
    workspace,
    workspace.site!.version,
    Object.fromEntries(workspace.pages.map((page) => [page.id, page.version])),
  );
}
