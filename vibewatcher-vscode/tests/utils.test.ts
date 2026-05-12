import { STATUS_EMOJI, formatDuration } from '../src/utils';
import { Status } from 'vibewatcher-shared';

describe('utils', () => {
  describe('STATUS_EMOJI', () => {
    it('should have emoji for all status types', () => {
      expect(STATUS_EMOJI.RUNNING).toBe('🟢');
      expect(STATUS_EMOJI.WAITING_INPUT).toBe('🟡');
      expect(STATUS_EMOJI.COMPLETED).toBe('🔵');
      expect(STATUS_EMOJI.ERROR).toBe('🔴');
    });

    it('should be a Record mapping Status to string', () => {
      const statuses: Status[] = ['RUNNING', 'WAITING_INPUT', 'COMPLETED', 'ERROR'];
      statuses.forEach(status => {
        expect(typeof STATUS_EMOJI[status]).toBe('string');
        expect(STATUS_EMOJI[status].length).toBeGreaterThan(0);
      });
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(30000)).toBe('30s');
      expect(formatDuration(59999)).toBe('59s');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60000)).toBe('1m');
      expect(formatDuration(120000)).toBe('2m');
      expect(formatDuration(600000)).toBe('10m');
    });

    it('should format minutes and seconds correctly', () => {
      expect(formatDuration(65000)).toBe('1m5s');
      expect(formatDuration(90000)).toBe('1m30s');
      expect(formatDuration(3661000)).toBe('61m1s');
    });

    it('should handle edge cases', () => {
      expect(formatDuration(1)).toBe('0s');
      expect(formatDuration(999)).toBe('0s');
      expect(formatDuration(60001)).toBe('1m'); // 60001ms = 60.001s = 1m
      expect(formatDuration(61000)).toBe('1m1s'); // 61000ms = 61s = 1m1s
    });
  });
});
