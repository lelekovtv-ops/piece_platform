interface ProviderSelectProps {
  providers: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string) => void;
}

export default function ProviderSelect({
  providers,
  value,
  onChange,
}: ProviderSelectProps) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500"
    >
      <option value="" disabled>
        Select provider…
      </option>
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
