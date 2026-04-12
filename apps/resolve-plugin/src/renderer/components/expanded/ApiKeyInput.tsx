import { useState, useCallback } from "react";

interface ApiKeyInputProps {
  label: string;
  value: string;
  onChange: (key: string) => void;
}

export default function ApiKeyInput({
  label,
  value,
  onChange,
}: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);

  const toggle = useCallback(() => setVisible((v) => !v), []);

  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <div className="flex gap-1">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter API key…"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500"
        />
        <button
          type="button"
          onClick={toggle}
          className="rounded-lg border border-neutral-700 px-2 text-xs text-neutral-400 hover:text-neutral-200"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
