import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_CAPABILITIES,
  LEGACY_PROJECT_CAPABILITIES,
  projectCapabilities,
} from "../../shared/builderProjects";
import { requireGithubPublication } from "../../supabase/functions/_shared/githubPublication";
import { previewHtml } from "./previewHtml";
import { newDocument, starterBlocks } from "./starters";

describe("project capabilities", () => {
  it("keeps project previews disconnected unless their receiver is explicitly supplied", () => {
    const document = newDocument("Contact", "contact", false);
    document.data.content = [starterBlocks.ContactForm()];
    expect(previewHtml(document)).toContain('data-endpoint=""');
    expect(previewHtml(document, "/__builder-contact")).toContain(
      'data-endpoint="/__builder-contact"',
    );
  });
  it("validates switches independently of project names or IDs and drops extra data", () => {
    expect(
      projectCapabilities({
        ...DEFAULT_PROJECT_CAPABILITIES,
        hasInventory: true,
        token: "must not be returned",
      }),
    ).toEqual({ ...DEFAULT_PROJECT_CAPABILITIES, hasInventory: true });
    expect(projectCapabilities(LEGACY_PROJECT_CAPABILITIES)).toEqual(
      LEGACY_PROJECT_CAPABILITIES,
    );
  });
  it.each([
    undefined,
    null,
    {},
    { ...DEFAULT_PROJECT_CAPABILITIES, hasInventory: "true" },
    { ...DEFAULT_PROJECT_CAPABILITIES, publishPath: "github" },
    { ...LEGACY_PROJECT_CAPABILITIES, publishPath: "worker" },
  ])("refuses missing or unsafe routing settings: %j", (value) => {
    expect(() => projectCapabilities(value)).toThrow(/settings/);
  });
});

describe("GitHub publication project boundary", () => {
  const projectId = "11111111-1111-4111-8111-111111111111";
  function server(
    options: {
      member?: boolean;
      canPublish?: boolean;
      archived?: boolean;
      capabilities?: unknown;
    } = {},
  ) {
    const filters: [string, string, unknown][] = [];
    return {
      filters,
      from(table: string) {
        return {
          select() {
            return this;
          },
          eq(key: string, value: unknown) {
            filters.push([table, key, value]);
            return this;
          },
          async maybeSingle() {
            return {
              error: null,
              data:
                table === "builder_project_members"
                  ? options.member === false
                    ? null
                    : { can_publish: options.canPublish !== false }
                  : {
                      id: projectId,
                      archived: options.archived || false,
                      capabilities:
                        "capabilities" in options
                          ? options.capabilities
                          : LEGACY_PROJECT_CAPABILITIES,
                    },
            };
          },
        };
      },
    };
  }
  it("uses the requested project for both membership and configuration", async () => {
    const service = server();
    await expect(
      requireGithubPublication(service, projectId, "editor"),
    ).resolves.toMatchObject({ id: projectId });
    expect(service.filters).toEqual([
      ["builder_project_members", "project_id", projectId],
      ["builder_project_members", "user_id", "editor"],
      ["builder_projects", "id", projectId],
    ]);
  });
  it.each([undefined, "", "../kaizen", "not-a-project"])(
    "rejects absent or invalid project selection: %j",
    async (id) => {
      const service = server();
      await expect(
        requireGithubPublication(service, id, "editor"),
      ).rejects.toMatchObject({ status: 400 });
      expect(service.filters).toEqual([]);
    },
  );
  it.each([{ member: false }, { canPublish: false }, { archived: true }])(
    "rejects missing publish access: %j",
    async (options) => {
      await expect(
        requireGithubPublication(server(options), projectId, "editor"),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
  it.each([
    DEFAULT_PROJECT_CAPABILITIES,
    undefined,
    {},
    { ...DEFAULT_PROJECT_CAPABILITIES, publishPath: "github" },
  ])(
    "never routes a client or invalid configuration to the legacy worker: %j",
    async (capabilities) => {
      await expect(
        requireGithubPublication(server({ capabilities }), projectId, "editor"),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
});
