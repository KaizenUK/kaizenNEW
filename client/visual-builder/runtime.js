/* Kaizen published interactions. No editor, framework, credentials or uploaded code. */
(() => {
  function initialise() {
    document
      .querySelectorAll("[data-kb-contact]:not([data-kb-ready])")
      .forEach((form) => {
        form.setAttribute("data-kb-ready", "");
        const endpoint = form.dataset.endpoint;
        const button = form.querySelector('[type="submit"]');
        const fields = form.querySelector("fieldset");
        const status = form.querySelector("[data-kb-form-status]");
        let pending = false,
          lastPayload = "",
          requestId = "";
        const label = button.textContent;
        button.disabled = !endpoint;
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (pending || !endpoint || !form.reportValidity()) return;
          if (document.documentElement.hasAttribute("data-kb-preview")) {
            status.textContent =
              "Preview only — no message was sent. Test delivery on the published page.";
            status.focus();
            return;
          }
          const data = new FormData(form);
          const payload = {};
          for (const key of [
            "name",
            "last_name",
            "email",
            "phone",
            "website",
            "message",
            "company_address",
          ])
            payload[key] = String(data.get(key) || "").trim();
          payload.consent_to_gdpr = data.has("consent_to_gdpr");
          payload.marketing_consent = data.has("marketing_consent");
          payload.source_page = location.pathname;
          payload.user_agent = navigator.userAgent.slice(0, 500);
          const serialised = JSON.stringify(payload);
          if (lastPayload !== serialised) {
            requestId = crypto.randomUUID();
            lastPayload = serialised;
          }
          pending = true;
          fields.disabled = true;
          form.setAttribute("aria-busy", "true");
          status.textContent = "Sending your message…";
          status.dataset.state = "sending";
          button.textContent = "Sending…";
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              credentials: "omit",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, request_id: requestId }),
              signal: controller.signal,
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.ok !== true)
              throw new Error(
                response.status === 429
                  ? "Too many messages. Please wait ten minutes and try again."
                  : [400, 409].includes(response.status) &&
                      typeof result?.error === "string"
                    ? result.error.slice(0, 250)
                    : "We couldn’t confirm your message was saved. Please try again.",
              );
            status.textContent = form.dataset.success;
            status.dataset.state = "success";
            form.reset();
            fields.hidden = true;
          } catch (error) {
            status.textContent =
              error.name === "AbortError"
                ? "The connection timed out. Your details are still here; please try again."
                : error.message;
            status.dataset.state = "error";
          } finally {
            clearTimeout(timeout);
            pending = false;
            fields.disabled = false;
            form.removeAttribute("aria-busy");
            button.textContent = label;
            status.focus();
          }
        });
      });
    document
      .querySelectorAll("[data-kb-tabs]:not([data-kb-ready])")
      .forEach((root) => {
        const list = root.querySelector("[data-kb-tablist]");
        const tabs = [...list.querySelectorAll("[data-kb-tab]")];
        const panels = [...root.querySelectorAll("[data-kb-panel]")];
        if (!tabs.length || tabs.length !== panels.length) return;
        root.setAttribute("data-kb-ready", "");
        list.hidden = false;
        list.setAttribute("role", "tablist");
        list.setAttribute(
          "aria-label",
          root.getAttribute("aria-label") || "More information",
        );
        function activate(index, focus) {
          tabs.forEach((tab, i) => {
            tab.setAttribute("aria-selected", String(i === index));
            tab.tabIndex = i === index ? 0 : -1;
            panels[i].hidden = i !== index;
          });
          if (focus) tabs[index].focus();
        }
        tabs.forEach((tab, index) => {
          tab.setAttribute("role", "tab");
          panels[index].setAttribute("role", "tabpanel");
          panels[index].setAttribute("aria-labelledby", tab.id);
          panels[index].tabIndex = 0;
          tab.addEventListener("click", () => activate(index, false));
          tab.addEventListener("keydown", (event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (index + tabs.length - 1) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : null;
            if (next !== null) {
              event.preventDefault();
              activate(next, true);
            }
          });
        });
        activate(0, false);
      });
    document
      .querySelectorAll("[data-kb-menu]:not([data-kb-ready])")
      .forEach((menu) => {
        menu.setAttribute("data-kb-ready", "");
        menu.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && menu.open) {
            event.preventDefault();
            menu.open = false;
            menu.querySelector("summary").focus();
          }
        });
        menu.addEventListener("click", (event) => {
          if (event.target.closest("a")) menu.open = false;
        });
        menu.addEventListener("focusout", () => {
          queueMicrotask(() => {
            if (!menu.contains(document.activeElement)) menu.open = false;
          });
        });
      });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
