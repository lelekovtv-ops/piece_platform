import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "../../../../src/renderer/stores/ui-store.ts";

describe("ui-store", () => {
  beforeEach(() => {
    useUiStore.getState().reset();
  });

  it("starts in bubble mode with idle state", () => {
    const state = useUiStore.getState();
    expect(state.mode).toBe("expanded");
    expect(state.bubbleState).toBe("idle");
  });

  it("setMode changes mode", () => {
    useUiStore.getState().setMode("expanded");
    expect(useUiStore.getState().mode).toBe("expanded");
  });

  it("setBubbleState changes bubble animation state", () => {
    useUiStore.getState().setBubbleState("generating");
    expect(useUiStore.getState().bubbleState).toBe("generating");
  });

  it("setBubbleState to success", () => {
    useUiStore.getState().setBubbleState("success");
    expect(useUiStore.getState().bubbleState).toBe("success");
  });

  it("setBubbleState to error", () => {
    useUiStore.getState().setBubbleState("error");
    expect(useUiStore.getState().bubbleState).toBe("error");
  });

  it("reset returns to initial state", () => {
    useUiStore.getState().setMode("expanded");
    useUiStore.getState().setBubbleState("generating");
    useUiStore.getState().reset();

    const state = useUiStore.getState();
    expect(state.mode).toBe("expanded");
    expect(state.bubbleState).toBe("idle");
  });
});
