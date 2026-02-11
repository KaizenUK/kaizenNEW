import { Studio as SanityStudio } from "sanity";
import config from "../../sanity.config";

export default function Studio() {
  return (
    <div style={{ height: "100vh" }}>
      <SanityStudio config={config} />
    </div>
  );
}
