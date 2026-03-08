import { describe, expect, it } from "vitest";

describe("test environment browser APIs", () => {
  it("provides matchMedia for theme-related modules", async () => {
    expect(typeof window.matchMedia).toBe("function");
    await expect(import("@/stores/use-theme-store")).resolves.toBeDefined();
  });
});
