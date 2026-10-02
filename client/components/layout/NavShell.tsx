import { MarketingHeader } from "../untitled/navigation/MarketingHeader";

export default function NavShell({ pathname }: { pathname: string }) {
  return <MarketingHeader pathname={pathname} />;
}
