interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  generating?: boolean;
}

export default function GenerateButton({
  onClick,
  disabled,
  generating,
}: GenerateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || generating}
      className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
    >
      {generating ? "Generating…" : "Generate"}
    </button>
  );
}
