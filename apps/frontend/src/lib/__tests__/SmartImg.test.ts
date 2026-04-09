import { describe, it, expect, vi } from "vitest"
import React from "react"

const { SmartImg } = await import("../../components/ui/SmartImg")

function render(jsx: React.ReactElement) {
  const ReactDOMServer = require("react-dom/server")
  return ReactDOMServer.renderToString(jsx)
}

describe("SmartImg", () => {
  it("should render an img tag with correct src", () => {
    const html = render(
      React.createElement(SmartImg, {
        src: "blob:http://localhost/abc",
        alt: "test",
      })
    )
    expect(html).toContain("blob:http://localhost/abc")
    expect(html).toContain('alt="test"')
  })

  it("should include shimmer skeleton class on wrapper", () => {
    const html = render(
      React.createElement(SmartImg, {
        src: "blob:http://localhost/abc",
        alt: "test",
      })
    )
    expect(html).toContain("animate-pulse")
  })

  it("should default to loading=lazy", () => {
    const html = render(
      React.createElement(SmartImg, {
        src: "blob:http://localhost/abc",
        alt: "test",
      })
    )
    expect(html).toContain('loading="lazy"')
  })

  it("should allow overriding loading to eager", () => {
    const html = render(
      React.createElement(SmartImg, {
        src: "blob:http://localhost/abc",
        alt: "test",
        loading: "eager",
      })
    )
    expect(html).toContain('loading="eager"')
  })

  it("should forward className", () => {
    const html = render(
      React.createElement(SmartImg, {
        src: "/storage/koza-uploads/test.jpg",
        alt: "test",
        className: "h-full w-full object-cover",
      })
    )
    expect(html).toContain("object-cover")
  })

  it("should accept storageKey for fallback", () => {
    const html = render(
      React.createElement(SmartImg, {
        src: "/img/abc/test.jpg",
        alt: "test",
        storageKey: "team/project/test.jpg",
      })
    )
    expect(html).toContain("/img/abc/test.jpg")
  })
})
