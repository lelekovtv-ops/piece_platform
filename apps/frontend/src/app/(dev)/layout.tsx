import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "PIECE — Dev Tools",
  description: "Developer tools and sandbox",
}

export default function DevGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
