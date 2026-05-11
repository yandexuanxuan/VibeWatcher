export const PROMPT_PATTERNS = [
  /proceed\?/i,
  /y\/n/i,
  /continue\?/i,
  /press enter/i,
  /confirm/i,
  /yes\/no/i,
];

export function matchPrompt(text: string): boolean {
  return PROMPT_PATTERNS.some(pattern => pattern.test(text));
}