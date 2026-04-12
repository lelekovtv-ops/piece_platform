import { describe, it, expect, beforeEach } from "vitest";
import { useKeysStore } from "../../../../src/renderer/stores/keys-store.ts";

describe("keys-store", () => {
  beforeEach(() => {
    useKeysStore.getState().reset();
  });

  it("starts with empty keys", () => {
    expect(useKeysStore.getState().keys).toEqual({});
  });

  it("setKey stores a provider key", () => {
    useKeysStore.getState().setKey("gemini", "AIza...");
    expect(useKeysStore.getState().keys.gemini).toBe("AIza...");
  });

  it("setKey overwrites existing key", () => {
    useKeysStore.getState().setKey("gemini", "old");
    useKeysStore.getState().setKey("gemini", "new");
    expect(useKeysStore.getState().keys.gemini).toBe("new");
  });

  it("removeKey removes a specific key", () => {
    useKeysStore.getState().setKey("gemini", "AIza...");
    useKeysStore.getState().setKey("sjinn", "eba...");
    useKeysStore.getState().removeKey("gemini");
    expect(useKeysStore.getState().keys.gemini).toBeUndefined();
    expect(useKeysStore.getState().keys.sjinn).toBe("eba...");
  });

  it("getKey returns value or empty string", () => {
    useKeysStore.getState().setKey("gemini", "AIza...");
    expect(useKeysStore.getState().getKey("gemini")).toBe("AIza...");
    expect(useKeysStore.getState().getKey("unknown")).toBe("");
  });

  it("loadKeys replaces all keys", () => {
    useKeysStore
      .getState()
      .loadKeys({ gemini: "a", sjinn: "b", "fal-flux": "c" });
    const keys = useKeysStore.getState().keys;
    expect(keys.gemini).toBe("a");
    expect(keys.sjinn).toBe("b");
    expect(keys["fal-flux"]).toBe("c");
  });

  it("reset clears all keys", () => {
    useKeysStore.getState().setKey("gemini", "value");
    useKeysStore.getState().reset();
    expect(useKeysStore.getState().keys).toEqual({});
  });
});
