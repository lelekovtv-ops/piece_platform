import type { GenerationTab } from "../stores/generation-store";

interface TabsProps {
  activeTab: GenerationTab;
  onTabChange: (tab: GenerationTab) => void;
}

const TABS: { id: GenerationTab; label: string }[] = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
];

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-neutral-800 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === tab.id
              ? "bg-violet-600 text-white"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
