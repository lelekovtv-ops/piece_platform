import type { Preview } from "@storybook/react"
import "../src/app/globals.css"

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#0B0C10" },
        { name: "surface", value: "#141210" },
        { name: "elevated", value: "#1A1916" },
        { name: "white", value: "#ffffff" },
      ],
    },
    layout: "centered",
  },
}

export default preview
