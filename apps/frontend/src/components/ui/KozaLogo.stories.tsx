import type { Meta, StoryObj } from "@storybook/react"
import { KozaLogo } from "./KozaLogo"

const meta = {
  title: "UI/KozaLogo",
  component: KozaLogo,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    variant: { control: "select", options: ["default", "terminal"] },
    showTagline: { control: "boolean" },
  },
} satisfies Meta<typeof KozaLogo>

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
