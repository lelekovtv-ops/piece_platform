import type { Meta, StoryObj } from "@storybook/react"
import { PieceLogo } from "./PieceLogo"

const meta = {
  title: "UI/PieceLogo",
  component: PieceLogo,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    variant: { control: "select", options: ["default", "terminal"] },
    showTagline: { control: "boolean" },
  },
} satisfies Meta<typeof PieceLogo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { size: "md", variant: "default", showTagline: false },
}

export const Large: Story = {
  args: { size: "lg", variant: "default", showTagline: true },
}

export const Terminal: Story = {
  args: { size: "lg", variant: "terminal", showTagline: true },
}

export const Small: Story = {
  args: { size: "sm", variant: "default", showTagline: false },
}
