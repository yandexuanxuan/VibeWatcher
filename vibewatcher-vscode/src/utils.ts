import { Status } from 'vibewatcher-shared';

export const STATUS_EMOJI: Record<Status, string> = {
  RUNNING: '🟢',
  WAITING_INPUT: '🟡',
  COMPLETED: '🔵',
  ERROR: '🔴',
};

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m${rem}s` : `${m}m`;
}
