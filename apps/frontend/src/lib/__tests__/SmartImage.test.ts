import { describe, it, expect, vi } from "vitest"
import React from "react"

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, unoptimized, priority, ...rest } = props
    return React.createElement("img", {
      ...rest,
      "data-fill": fill ? "true" : undefined,
      "data-unoptimized": unoptimized ? "true" : undefined,
      "data-priority": priority ? "true" : undefined,
    })
  },
}))

// Must import AFTER mocking next/image
const { SmartImage } = await import("../../components/ui/SmartImage")

async function render(jsx: React.ReactElement) {
  const ReactDOMServer = await import("react-dom/server")
  return ReactDOMServer.renderToString(jsx)
}

describe("SmartImage", () => {
  it("should render an img tag with correct src", async () => {
    const html = await render(
      React.createElement(SmartImage, {
        src: "/img/abc/fill/200x200/piece-uploads/test.jpg",
        alt: "test",
        fill: true,
      })
    )
    expect(html).toContain("/img/abc/fill/200x200/piece-uploads/test.jpg")
    expect(html).toContain('alt="test"')
  })

  it("should include shimmer skeleton class", async () => {
    const html = await render(
      React.createElement(SmartImage, {
        src: "/img/abc/test.jpg",
        alt: "test",
        fill: true,
      })
    )
    expect(html).toContain("animate-pulse")
  })

  it("should forward className to the wrapper", async () => {
    const html = await render(
      React.createElement(SmartImage, {
        src: "/img/abc/test.jpg",
        alt: "test",
        fill: true,
        className: "object-cover",
      })
    )
    expect(html).toContain("object-cover")
  })

  it("should accept sizes prop", async () => {
    const html = await render(
      React.createElement(SmartImage, {
        src: "/img/abc/test.jpg",
        alt: "test",
        fill: true,
        sizes: "(max-width: 768px) 100vw, 50vw",
      })
    )
    expect(html).toContain("(max-width: 768px) 100vw, 50vw")
  })

  it("should accept storageKey for fallback", async () => {
    const html = await render(
      React.createElement(SmartImage, {
        src: "/img/abc/test.jpg",
        alt: "test",
        fill: true,
        storageKey: "team/project/test.jpg",
      })
    )
    expect(html).toContain("/img/abc/test.jpg")
  })
})
