export function stripMarkdown(raw) {
  let text = raw;

  text = text.replace(/```[\s\S]*?```/g, (match) => {
    const inner = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
    return inner;
  });

  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '$1');
  text = text.replace(/___(.*?)___/g, '$1');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');

  text = text.replace(/^#{1,6}\s+/gm, '');

  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  text = text.replace(/^>\s?/gm, '');

  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  text = text.replace(/\n{4,}/g, '\n\n');

  return text.trim();
}
