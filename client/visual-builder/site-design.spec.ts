import { describe, it, expect } from "vitest";
import {
  inspectSource,
  editSource,
} from "../../scripts/builder-source-editing";
describe("M5 registered source design controls", () => {
  it("exposes and patches literal styles only within a recognised registration, preserving other code", async () => {
    const source = `export const registered={type:'Registered',props:{id:'panel',registrationId:'content-panel-v1',text:'Our panel',style:{desktop:{padding:24,background:'#ffffff'},mobile:{padding:12}}}};export const ordinary={style:{desktop:{padding:40,background:'#000000'}}};`;
    const inspected = await inspectSource("src/content/blocks.ts", source);
    const fields = inspected.fields.filter((f) => f.design);
    expect(fields.map((f) => f.label)).toEqual([
      "desktop padding",
      "desktop background",
      "mobile padding",
    ]);
    expect(
      inspected.fields.find((f) => f.value === "Our panel")?.registration,
    ).toEqual({ id: "content-panel-v1", blockId: "panel" });
    const padding = fields[0];
    expect(
      await editSource(
        "src/content/blocks.ts",
        source,
        { [padding.id]: "48" },
        {},
      ),
    ).toBe(source.replace("padding:24", "padding:48"));
    await expect(
      editSource("src/content/blocks.ts", source, { [padding.id]: "300" }, {}),
    ).rejects.toThrow("between");
    await expect(
      editSource(
        "src/content/blocks.ts",
        source,
        { [padding.id]: "1;process.exit()" },
        {},
      ),
    ).rejects.toThrow("between");
    await expect(
      editSource(
        "src/content/blocks.ts",
        source,
        { [fields[1].id]: "url(https://example.com)" },
        {},
      ),
    ).rejects.toThrow("hex colour");
  });
  it("does not expose designs for unknown registrations or computed values", async () => {
    const result = await inspectSource(
      "src/content/blocks.ts",
      `export const props={id:'panel',registrationId:'unknown',style:{desktop:{padding:24}}};export const other={id:'valid',registrationId:'content-panel-v1',style:{desktop:{padding:getSpacing()}}};`,
    );
    expect(result.fields.some((f) => f.design)).toBe(false);
  });
});
