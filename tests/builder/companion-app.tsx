import React from "react";
import { createRoot } from "react-dom/client";
import HostedRepository from "../../client/visual-builder/HostedRepository";
import { companionConnection } from "../../client/visual-builder/companionConnection";
import { storage } from "../../client/visual-builder/storage";
import SitePageEditor from "../../client/visual-builder/SitePageEditor";
import "../../client/visual-builder/builder.css";

// Only the host page is a fixture. The same components, transport, consent
// window and filesystem operations as the original inline entry stay in use.
(window as any).testRepository = (input: unknown) => storage.repository(input);
(window as any).testConnection = companionConnection;

function Harness() {
  const [site, setSite] = React.useState(false);
  return site ? (
    <SitePageEditor
      page={{
        root: companionConnection.snapshot().root,
        route: "src/pages/index.astro",
        path: "/",
        title: "Paired page",
      }}
      workspace={{ pages: [], assets: [], saved: [] }}
      onWorkspace={() => {}}
      onBack={() => setSite(false)}
      theme="light"
      onToggleTheme={() => {}}
    />
  ) : (
    <div className="builder-app" data-theme="light">
      <button onClick={() => setSite(true)}>Open website page editor</button>
      <HostedRepository />
    </div>
  );
}
createRoot(document.getElementById("app")!).render(<Harness />);
