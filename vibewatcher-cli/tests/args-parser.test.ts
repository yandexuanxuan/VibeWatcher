import { hideBin } from 'yargs/helpers';

describe('Argument Parsing', () => {
  describe('hideBin behavior', () => {
    it('should strip node and script path', () => {
      const argv = ['node', 'dist/cli.js', 'command'];
      const result = hideBin(argv);
      expect(result).toEqual(['command']);
    });

    it('should handle arguments with hyphens', () => {
      const argv = ['node', 'dist/cli.js', 'node', '-e', 'console.log("test")'];
      const result = hideBin(argv);
      expect(result).toEqual(['node', '-e', 'console.log("test")']);
    });

    it('should preserve double-dash arguments', () => {
      const argv = ['node', 'dist/cli.js', 'git', '--help'];
      const result = hideBin(argv);
      expect(result).toEqual(['git', '--help']);
    });

    it('should handle complex npm scripts', () => {
      const argv = ['node', 'dist/cli.js', 'npm', 'run', 'build', '--', '--verbose'];
      const result = hideBin(argv);
      expect(result).toEqual(['npm', 'run', 'build', '--', '--verbose']);
    });

    it('should handle empty result', () => {
      const argv = ['node', 'dist/cli.js'];
      const result = hideBin(argv);
      expect(result).toEqual([]);
    });

    it('should preserve quoted arguments', () => {
      const argv = ['node', 'dist/cli.js', 'echo', 'hello world'];
      const result = hideBin(argv);
      expect(result).toEqual(['echo', 'hello world']);
    });

    it('should handle shell commands with pipes', () => {
      const argv = ['node', 'dist/cli.js', 'sh', '-c', 'cat file | grep pattern'];
      const result = hideBin(argv);
      expect(result).toEqual(['sh', '-c', 'cat file | grep pattern']);
    });

    it('should handle special characters in arguments', () => {
      const argv = ['node', 'dist/cli.js', 'echo', '$HOME', '`date`'];
      const result = hideBin(argv);
      expect(result).toEqual(['echo', '$HOME', '`date`']);
    });
  });

  describe('Command validation', () => {
    it('should detect empty command', () => {
      const argv = ['node', 'dist/cli.js'];
      const args = hideBin(argv);
      expect(args.length).toBe(0);
    });

    it('should preserve single character commands', () => {
      const argv = ['node', 'dist/cli.js', 'g', 'status'];
      const args = hideBin(argv);
      expect(args).toEqual(['g', 'status']);
    });
  });
});
