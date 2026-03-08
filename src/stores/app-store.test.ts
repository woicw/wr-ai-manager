import { describe, expect, it } from "vitest";

import { createAppStore } from "./app-store";

describe("createAppStore", () => {
  it("tracks library refresh signals from a clean initial state", () => {
    const store = createAppStore();

    expect(store.getState().libraryVersion).toBe(0);

    store.getState().bumpLibraryVersion();
    store.getState().bumpLibraryVersion();

    expect(store.getState().libraryVersion).toBe(2);
  });
});
