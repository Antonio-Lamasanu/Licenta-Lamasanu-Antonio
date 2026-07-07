/**
 * Short text shown in the composer/chat bubble for a "Change this" request -
 * editable by the user, sent to the backend verbatim only if unmodified.
 */
export function buildEditDisplayPrompt(text: string): string {
  return `Rewrite this to be better: "${text}"`;
}

/**
 * Full instruction actually sent to the model. Gives it real context (unlike the
 * short display text) and asks it to wrap the final rewrite in markers so the app
 * can pick out the suggestion even if the model asks a clarifying question first.
 */
export function buildEditWirePrompt(text: string, extraContext?: string): string {
  const parts = [
    "Rewrite the following text to make it better - improve word choice, flow, and impact while preserving the meaning and roughly the same length. This is a request for a direct rewrite, not a general conversation.",
    "Only the selected snippet below (see 'Text to rewrite') is what you should actually rewrite - even if additional context like the full note is provided below, rewrite ONLY the snippet, not the whole thing.",
  ];
  if (extraContext) {
    parts.push(
      `The user has provided this additional context (e.g. their full note) so the rewrite fits the rest of the piece - use it to inform tense, narrator, rhyme scheme, and story beats, but do not rewrite it:\n${extraContext}`
    );
  } else {
    parts.push(
      "You have NOT been given the rest of the note/song it comes from unless it appears earlier in this conversation. Rewriting a snippet in isolation risks the wrong tense, a mismatched narrator, or contradicting a rhyme scheme or story beat established elsewhere. If the snippet is short, ambiguous, or its meaning clearly depends on surrounding lines you haven't seen, do NOT guess - ask the user to paste the full note first (they can use 'Insert full note') and stop there instead of producing a rewrite."
    );
  }
  parts.push(
    "If you do have enough context (either the snippet is self-contained, or the full note is available above), respond with ONLY your rewritten version wrapped exactly like this, with nothing else outside the wrapper - do not add quote marks around it:",
    "<<<REWRITE>>>\nyour rewritten text here\n<<<END>>>",
    `Text to rewrite:\n"${text}"`
  );
  return parts.join("\n\n");
}

const REWRITE_RE = /<<<REWRITE>>>([\s\S]*?)<<<END>>>/;

const QUOTE_PAIRS: [string, string][] = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
];

/** Strips one layer of matching leading/trailing quote characters, if present. */
function stripWrappingQuotes(text: string): string {
  for (const [open, close] of QUOTE_PAIRS) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close)) {
      return text.slice(open.length, -close.length).trim();
    }
  }
  return text;
}

/** Pulls the wrapped rewrite out of a model reply, or null if it didn't use the format. */
export function extractRewrite(text: string): string | null {
  const match = REWRITE_RE.exec(text);
  if (!match) return null;
  return stripWrappingQuotes(match[1].trim());
}
