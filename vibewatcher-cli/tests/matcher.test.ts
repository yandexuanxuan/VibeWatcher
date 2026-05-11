import { matchPrompt, PROMPT_PATTERNS } from '../src/matcher';

describe('matchPrompt', () => {
  it('should match proceed?', () => {
    expect(matchPrompt('Do you want to proceed?')).toBe(true);
    expect(matchPrompt('Proceed?')).toBe(true);
  });

  it('should match y/n', () => {
    expect(matchPrompt('Continue? (y/n)')).toBe(true);
    expect(matchPrompt('y/N')).toBe(true);
  });

  it('should match continue?', () => {
    expect(matchPrompt('Continue? [y/n]')).toBe(true);
  });

  it('should match press enter', () => {
    expect(matchPrompt('Press Enter to continue')).toBe(true);
  });

  it('should match confirm', () => {
    expect(matchPrompt('Please confirm your action')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(matchPrompt('PROCEED?')).toBe(true);
    expect(matchPrompt('YES/NO')).toBe(true);
  });

  it('should not match regular text', () => {
    expect(matchPrompt('Hello world')).toBe(false);
    expect(matchPrompt('Running task 123')).toBe(false);
  });
});