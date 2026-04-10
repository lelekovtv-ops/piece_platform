import type { Meta, StoryObj } from "@storybook/react"
import { ProjectStylePicker } from "./ProjectStylePicker"
import { useState } from "react"

const meta = {
  title: "UI/ProjectStylePicker",
  component: ProjectStylePicker,
  decorators: [
    (Story, context) => {
      const [style, setStyle] = useState(context.args.projectStyle ?? "")
      return <Story args={{ ...context.args, projectStyle: style, setProjectStyle: setStyle }} />
    },
  ],
} satisfies Meta<typeof ProjectStylePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    projectStyle: "",
    setProjectStyle: () => {},
  },
}

export const WithCustomStyle: Story = {
  args: {
    projectStyle: "Neon-noir aesthetic with high contrast lighting",
    setProjectStyle: () => {},
  },
}
