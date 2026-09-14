import type {
  BuilderPage,
  PageDocument,
  SiteDesign,
  SiteState,
  Workspace,
} from "../../shared/visualBuilder";
import { initialSiteDesign } from "../../shared/builderSite";

type PageStore = {
  save: (
    id: string,
    version: number,
    document: PageDocument,
    label: string,
  ) => Promise<BuilderPage>;
  load: () => Promise<Workspace>;
  saveSite: (version: number, design: SiteDesign) => Promise<SiteState>;
};

/** A lost creation acknowledgement must not turn Retry into a second page. */
export async function saveTemplatePage(
  store: PageStore,
  id: string,
  document: PageDocument,
) {
  const before = await store.load();
  const previous = before.pages.find((page) => page.id === id);
  if (previous && JSON.stringify(previous.draft) === JSON.stringify(document))
    return previous;
  if (document.site?.useTheme && !before.site) {
    try {
      await store.saveSite(0, initialSiteDesign());
    } catch (failure) {
      // Another editor may have chosen a design while this request was in flight.
      // Its version wins; never replace it with our default.
      if (!(await store.load()).site) throw failure;
    }
  }
  try {
    return await store.save(
      id,
      0,
      document,
      `Created ${document.title} from a template`,
    );
  } catch (failure) {
    try {
      const saved = (await store.load()).pages.find((page) => page.id === id);
      if (saved && JSON.stringify(saved.draft) === JSON.stringify(document))
        return saved;
    } catch {
      /* Keep the original failure when the recovery read also fails. */
    }
    throw failure;
  }
}
