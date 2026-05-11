export function parseLine(line: string): string {
  return line.trim();
}

export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map(parseLine).filter(line => line !== '');
}