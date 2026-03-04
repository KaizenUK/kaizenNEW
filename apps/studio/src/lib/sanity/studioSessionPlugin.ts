import { useEffect } from "react";
import { definePlugin, useCurrentUser } from "sanity";

const STUDIO_EDITOR_COOKIE = "kaizen_studio_auth";
const COOKIE_MAX_AGE_SECONDS = 900;
const COOKIE_DOMAIN = String(import.meta.env.VITE_EDITOR_COOKIE_DOMAIN ?? "").trim();

function writeEditorCookie(isAuthenticated: boolean): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domain = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : "";

  if (isAuthenticated) {
    document.cookie = `${STUDIO_EDITOR_COOKIE}=1; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}${domain}`;
    return;
  }

  document.cookie = `${STUDIO_EDITOR_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}${domain}`;
}

function StudioSessionLayout(props: any) {
  const user = useCurrentUser();

  useEffect(() => {
    writeEditorCookie(Boolean(user));
  }, [user]);

  return props.renderDefault(props);
}

export const studioSessionPlugin = definePlugin({
  name: "studio-session-plugin",
  studio: {
    components: {
      layout: StudioSessionLayout,
    },
  },
});
