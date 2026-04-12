interface DurationInputProps {
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export default function DurationInput({ min, max, value, onChange, disabled }: DurationInputProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-neutral-400 whitespace-nowrap">
        Duration
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-700 accent-violet-500 disabled:opacity-50"
      />
      <span className="min-w-[2.5rem] text-center text-xs font-medium text-neutral-200">
        {value}s
      </span>
    </div>
  );
}
