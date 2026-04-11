import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationStore } from "../../../../src/renderer/stores/generation-store.ts";

describe("generation-store", () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
  });

  it("starts in idle status", () => {
    const state = useGenerationStore.getState();
    expect(state.status).toBe("idle");
    expect(state.prompt).toBe("");
    expect(state.activeTab).toBe("image");
    expect(state.provider).toBeNull();
    expect(state.result).toBeNull();
    expect(state.error).toBeNull();
  });

  it("setPrompt updates prompt", () => {
    useGenerationStore.getState().setPrompt("A cat on Mars");
    expect(useGenerationStore.getState().prompt).toBe("A cat on Mars");
  });

  it("setActiveTab switches tab", () => {
    useGenerationStore.getState().setActiveTab("video");
    expect(useGenerationStore.getState().activeTab).toBe("video");
  });

  it("setProvider sets current provider", () => {
    useGenerationStore.getState().setProvider("gemini");
    expect(useGenerationStore.getState().provider).toBe("gemini");
  });

  it("setGenerating sets status to generating", () => {
    useGenerationStore.getState().setGenerating();
    expect(useGenerationStore.getState().status).toBe("generating");
    expect(useGenerationStore.getState().error).toBeNull();
    expect(useGenerationStore.getState().result).toBeNull();
  });

  it("setResult sets result and status to done", () => {
    useGenerationStore.getState().setResult({ clipName: "gen_001.png" });
    expect(useGenerationStore.getState().status).toBe("done");
    expect(useGenerationStore.getState().result).toEqual({
      clipName: "gen_001.png",
    });
  });

  it("setError sets error and status to error", () => {
    useGenerationStore.getState().setError("Provider failed");
    expect(useGenerationStore.getState().status).toBe("error");
    expect(useGenerationStore.getState().error).toBe("Provider failed");
  });

  it("setReferenceImage sets snapshot reference", () => {
    useGenerationStore.getState().setReferenceImage("/tmp/snap.png");
    expect(useGenerationStore.getState().referenceImage).toBe("/tmp/snap.png");
  });

  it("clearReferenceImage clears it", () => {
    useGenerationStore.getState().setReferenceImage("/tmp/snap.png");
    useGenerationStore.getState().clearReferenceImage();
    expect(useGenerationStore.getState().referenceImage).toBeNull();
  });

  it("reset returns to initial state", () => {
    useGenerationStore.getState().setPrompt("A dog");
    useGenerationStore.getState().setProvider("sjinn");
    useGenerationStore.getState().setGenerating();
    useGenerationStore.getState().reset();

    const state = useGenerationStore.getState();
    expect(state.status).toBe("idle");
    expect(state.prompt).toBe("");
    expect(state.provider).toBeNull();
  });
});
