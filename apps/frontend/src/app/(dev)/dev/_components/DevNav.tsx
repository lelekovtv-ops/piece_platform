"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Terminal, Clapperboard, Workflow, Box, Settings, ArrowLeft,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/dev", label: "Console", icon: Terminal },
  { href: "/dev/director-pipeline", label: "Director Pipeline", icon: Clapperboard },
  { href: "/dev/breakdown-studio", label: "Pipeline Constructor", icon: Workflow },
  { href: "/dev/previz-3d", label: "3D Previz", icon: Box },
  { href: "/dev/settings", label: "Settings", icon: Settings },
]

export function DevNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 px-3 h-10 bg-[#161514] border-b border-white/5 shrink-0">
      <Link
        href="/home"
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors mr-2"
      >
        <ArrowLeft size={14} />
        <span>App</span>
      </Link>

      <div className="w-px h-4 bg-white/10 mr-2" />

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/dev"
          ? pathname === "/dev"
          : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              isActive
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
