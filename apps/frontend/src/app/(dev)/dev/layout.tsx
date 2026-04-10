"use client"

import { DevNav } from "./_components/DevNav"

export default function DevLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DevNav />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
