import { Studio as SanityStudio } from "sanity";
import config from "../../sanity.config";
import "../../sanity/studio.css";

export default function Studio() {
  return (
    <div style={{ height: "100vh" }}>
      <SanityStudio config={config} />
    </div>
  );
}
