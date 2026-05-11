import { parseLine, splitLines } from '../src/parser';

describe('parseLine', () => {
  it('should return trimmed line', () => {
    const result = parseLine('  hello world  ');
    expect(result).toBe('hello world');
  });

  it('should handle empty line', () => {
    const result = parseLine('');
    expect(result).toBe('');
  });
});

describe('splitLines', () => {
  it('should split by newlines', () => {
    const result = splitLines('line1\nline2\nline3');
    expect(result).toEqual(['line1', 'line2', 'line3']);
  });

  it('should handle carriage return', () => {
    const result = splitLines('line1\r\nline2');
    expect(result).toEqual(['line1', 'line2']);
  });

  it('should handle trailing newline', () => {
    const result = splitLines('line1\nline2\n');
    expect(result).toEqual(['line1', 'line2']);
  });

  it('should filter empty lines at end', () => {
    const result = splitLines('line1\nline2\n\n\n');
    expect(result).toEqual(['line1', 'line2']);
  });

  it('should handle single line without newline', () => {
    const result = splitLines('single line');
    expect(result).toEqual(['single line']);
  });
});