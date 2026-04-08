"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Block } from "@/lib/screenplayFormat"

interface ScreenplayPanelProps {
  blocks: Block[]
  activeBlockId: string | null
  shotCountByBlock: Map<string, number>
  onBlockClick: (blockId: string) => void
  onBlockEdit: (blockId: string, text: string) => void
}

export function ScreenplayPanel({
  blocks,
  activeBlockId,
  shotCountByBlock,
  onBlockClick,
  onBlockEdit,
}: ScreenplayPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to active block
  useEffect(() => {
    if (!activeBlockId) return
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-block-id="${activeBlockId}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [activeBlockId])

  const handleBlur = useCallback(
    (blockId: string, e: React.FocusEvent<HTMLDivElement>) => {
      const newText = e.currentTarget.textContent ?? ""
      onBlockEdit(blockId, newText)
    },
    [onBlockEdit],
  )

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-5 py-4"
      style={{
        fontFamily: '"Courier New", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {blocks.map((block, index) => {
        const isAction = block.type === "action"
        const isActive = block.id === activeBlockId
        const shotCount = shotCountByBlock.get(block.id)

        return (
          <div key={block.id}>
            <div
              data-block-id={block.id}
              onClick={isAction ? () => onBlockClick(block.id) : undefined}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(block.id, e)}
              onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
              className={[
                "whitespace-pre-wrap outline-none transition-all duration-200",
                isActive
                  ? "bg-[#D4A853]/10 rounded -mx-2 px-2 border-l-2 border-[#D4A853]/40"
                  : isAction
                    ? "cursor-pointer hover:bg-white/3 rounded -mx-2 px-2"
                    : "",
                block.type === "scene_heading" ? `${index > 0 ? "mt-6" : "mt-0"} font-bold uppercase tracking-[0.08em] text-[#D4A853]/80` : "",
                block.type === "action" ? "mt-2 text-[#E5E0DB]" : "",
                block.type === "character" ? "mt-4 uppercase text-[#E5E0DB]/70" : "",
                block.type === "dialogue" ? "text-[#E5E0DB]/80" : "",
                block.type === "parenthetical" ? "text-[#A7A19A]" : "",
                block.type === "transition" ? "mt-4 text-right uppercase tracking-[0.08em] text-[#E5E0DB]/50" : "",
                block.type === "shot" ? "mt-4 text-[0.82em] uppercase tracking-[0.12em] text-[#C8C1B6]" : "",
              ].filter(Boolean).join(" ")}
              style={{
                marginLeft: block.type === "character"
                  ? "24ch"
                  : block.type === "dialogue"
                    ? "11ch"
                    : block.type === "parenthetical"
                      ? "18ch"
                      : 0,
              }}
            >
              {block.text}
            </div>

            {/* Shot count badge for action blocks */}
            {isAction && shotCount && shotCount > 0 && (
              <span
                className="mt-0.5 inline-flex items-center rounded-full bg-[#D4A853]/12 px-1.5 py-0 text-[8px] font-medium text-[#D4A853]/50 tabular-nums"
              >
                {shotCount} shot{shotCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
