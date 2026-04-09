"use client"

import { usePathname } from "next/navigation"
import { useScreenplaySettings } from "@/store/screenplaySettings"

export function MainContent({ children }: { children: React.ReactNode }) {
  const focusMode = useScreenplaySettings((s) => s.focusMode)
  const pathname = usePathname()
  const isLanding = pathname === "/home"

  return (
    <main className={`flex-1 overflow-auto ${focusMode || isLanding ? "pt-0" : "pt-[56px]"}`}>
      {children}
    </main>
  )
}
