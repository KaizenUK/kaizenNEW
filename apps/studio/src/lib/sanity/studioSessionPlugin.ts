import { useEffect } from "react";
import { definePlugin, useCurrentUser } from "sanity";

const STUDIO_EDITOR_COOKIE = "kaizen_studio_auth";
const COOKIE_MAX_AGE_SECONDS = 900;

function writeEditorCookie(isAuthenticated: boolean): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  if (isAuthenticated) {
    document.cookie = `${STUDIO_EDITOR_COOKIE}=1; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
    return;
  }

  document.cookie = `${STUDIO_EDITOR_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
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

