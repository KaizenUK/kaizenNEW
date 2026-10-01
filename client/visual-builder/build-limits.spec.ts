import { describe, expect, it } from "vitest";
import {
  defaultBuildLimits,
  validateBuildLimits,
} from "../../scripts/builder-build-sandbox";
import { nativeBuildLimits } from "../../scripts/builder-native-release";

const GiB = 1024 ** 3;

describe("native build resource allowance", () => {
  it("keeps the existing default and only opts in through the native operator setting", () => {
    expect(nativeBuildLimits({})).toEqual(defaultBuildLimits);
    expect(
      nativeBuildLimits({ NODE_OPTIONS: "--max-old-space-size=6144" }),
    ).toEqual(defaultBuildLimits);
    const limits = nativeBuildLimits({
      BUILDER_NATIVE_BUILD_MEMORY_BYTES: String(6 * GiB),
    });
    expect(limits).toEqual({ ...defaultBuildLimits, memoryBytes: 6 * GiB });
    expect(() => validateBuildLimits(limits, "trusted")).not.toThrow();
    expect(() => validateBuildLimits(limits)).toThrow();
    expect(defaultBuildLimits.memoryBytes).toBe(2 * GiB);
  });

  it.each([
    "",
    "0",
    "-1",
    "Infinity",
    "6e9",
    " 6442450944",
    "1.5",
    "9007199254740993",
    String(64 * 1024 ** 2 - 1),
    String(8 * GiB + 1),
  ])("refuses invalid or unbounded native memory: %s", (value) => {
    expect(() =>
      nativeBuildLimits({ BUILDER_NATIVE_BUILD_MEMORY_BYTES: value }),
    ).toThrow();
  });

  it("retains the process and CPU bounds for trusted builds", () => {
    for (const patch of [
      { processes: 129 },
      { cpuPercent: 201 },
      { processes: 7 },
      { cpuPercent: 9 },
    ])
      expect(() =>
        validateBuildLimits({ ...defaultBuildLimits, ...patch }, "trusted"),
      ).toThrow();
    expect(() =>
      validateBuildLimits(
        { ...defaultBuildLimits, memoryBytes: 8 * GiB },
        "trusted",
      ),
    ).not.toThrow();
    expect(() =>
      validateBuildLimits(
        { ...defaultBuildLimits, memoryBytes: 2 * GiB + 1 },
        "isolated",
      ),
    ).toThrow();
  });
});
