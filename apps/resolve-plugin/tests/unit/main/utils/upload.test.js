import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("fs", () => ({
  readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-file")),
}));

const { uploadFileForUrl } = await import("../../../../src/main/utils/upload.js");

describe("uploadFileForUrl", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("uploads file and returns direct download URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { url: "https://tmpfiles.org/12345/test.png" },
      }),
    });

    const url = await uploadFileForUrl("/path/to/test.png");
    expect(url).toBe("https://tmpfiles.org/dl/12345/test.png");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://tmpfiles.org/api/v1/upload",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on HTTP error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(uploadFileForUrl("/path/to/file.png")).rejects.toThrow(
      "Upload failed: 500",
    );
  });

  it("throws when response has no URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: {} }),
    });

    await expect(uploadFileForUrl("/path/to/file.png")).rejects.toThrow(
      "Upload returned no URL",
    );
  });
});
