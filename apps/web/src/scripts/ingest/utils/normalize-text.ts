export function normalizeText(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function joinTextParts(parts: unknown) {
  if (Array.isArray(parts)) {
    return normalizeText(
      parts
        .filter((part): part is string => typeof part === "string")
        .join("\n\n"),
    );
  }

  if (typeof parts === "string") {
    return normalizeText(parts);
  }

  return "";
}

