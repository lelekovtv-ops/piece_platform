interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function PromptInput({
  value,
  onChange,
  disabled,
}: PromptInputProps) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">Prompt</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Describe what you want to generate…"
        rows={3}
        className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500 disabled:opacity-50"
      />
    </div>
  );
}
