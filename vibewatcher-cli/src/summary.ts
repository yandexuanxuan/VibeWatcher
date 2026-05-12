import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Status } from './types';

const SUMMARY_DIR = path.join(os.homedir(), '.vibewatch', 'summaries');

const TASK_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SummaryResult {
  taskId: string;
  summaryPath: string;
  duration: number;
  keyword: string;
  status: Status;
}

export function generateSummary(params: {
  taskId: string;
  commandArgs: string[];
  outputLines: string[];
  duration: number;
  exitCode: number;
}): SummaryResult {
  const { taskId, commandArgs, outputLines, duration, exitCode } = params;

  const keyword = extractKeyword(commandArgs.join(' '));
  const status: Status = exitCode === 0 ? 'COMPLETED' : 'ERROR';

  const filesCreated = extractFiles(outputLines, ['Creating file', 'create file', 'created file']);
  const filesModified = extractFiles(outputLines, ['Writing', 'Modified', 'Updated', 'modified file', 'updated file']);
  const filesDeleted = extractFiles(outputLines, ['Deleted file', 'deleted file', 'removed file']);
  const todos = extractLines(outputLines, ['TODO', 'FIXME', 'WARNING:', 'warn(']);
  const keySteps = extractKeySteps(outputLines);

  const taskGoal = commandArgs.join(' ').replace(/^claude-code\s*/i, '').substring(0, 100);

  const durationStr = formatDuration(duration);
  const timestamp = new Date().toLocaleString('zh-CN');

  const markdown = [
    `# VibeWatcher 执行摘要`,
    ``,
    `| 字段 | 内容 |`,
    `|------|------|`,
    `| 任务ID | \`${taskId}\` |`,
    `| 任务目标 | ${taskGoal || '(无)'} |`,
    `| 关键词 | ${keyword} |`,
    `| 状态 | ${getStatusEmoji(status)} ${status} |`,
    `| 耗时 | ${durationStr} |`,
    `| 退出码 | ${exitCode} |`,
    `| 完成时间 | ${timestamp} |`,
    ``,
    filesCreated.length > 0 ? `## 新增文件\n${filesCreated.map((f) => `- \`${f}\``).join('\n')}` : '',
    filesModified.length > 0 ? `## 修改文件\n${filesModified.map((f) => `- \`${f}\``).join('\n')}` : '',
    filesDeleted.length > 0 ? `## 删除文件\n${filesDeleted.map((f) => `- \`${f}\``).join('\n')}` : '',
    ``,
    keySteps.length > 0 ? `## 关键操作\n${keySteps.map((s) => `- ${s}`).join('\n')}` : '',
    ``,
    todos.length > 0 ? `## TODO / 警告\n${todos.map((t) => `\`${t.trim()}\``).join('\n')}` : '',
    ``,
    `## 原始输出 (最后 20 行)`,
    '```',
    ...outputLines.slice(-20),
    '```',
  ]
    .filter((line) => line !== '')
    .join('\n');

  if (!fs.existsSync(SUMMARY_DIR)) {
    fs.mkdirSync(SUMMARY_DIR, { recursive: true });
  }

  if (!TASK_ID_RE.test(taskId)) {
    throw new Error('Invalid taskId format');
  }

  const summaryPath = path.join(SUMMARY_DIR, `${taskId}.md`);
  fs.writeFileSync(summaryPath, markdown, 'utf-8');

  return { taskId, summaryPath, duration, keyword, status };
}

export function extractKeyword(input: string): string {
  const patterns = [
    /\brefactor(?:ing|ed)?\b/i,
    /\bgenerate(?:d)?\b/i,
    /\btest(?:ing|ed)?\b/i,
    /\bfix(?:ed)?\b/i,
    /\bbuild(?:ing)?\b/i,
    /\bdeploy(?:ing|ed)?\b/i,
    /\bimplement(?:ed)?\b/i,
    /\badd(?:ed)?\b/i,
    /\bremove(?:d)?\b/i,
    /\bupdate(?:d)?\b/i,
    /\bcreate(?:d)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[0].toLowerCase();
  }

  // 优先匹配复杂动词（放在简单动词之后）
  const priorityPatterns = [
    /\boptimiz(?:e|ing|ed)\b/i,
    /\bclean(?:ing|ed)?\b/i,
    /\bdup(?:licat|ing|ed)?\b/i,
    /\bmerg(?:e|ing|ed)\b/i,
    /\bspli(?:t|ting)\b/i,
    /\bstructur(?:e|ing|ed)\b/i,
    /\banalyz(?:e|ing|ed)\b/i,
    /\baudit(?:ing|ed)?\b/i,
    /\breleas(?:e|ing|ed)\b/i,
    /\bpublish(?:ing|ed)?\b/i,
  ];

  for (const pattern of priorityPatterns) {
    const match = input.match(pattern);
    if (match) return match[0].toLowerCase();
  }

  return 'general';
}

function extractFiles(lines: string[], prefixes: string[]): string[] {
  const files = new Set<string>();
  for (const line of lines) {
    for (const prefix of prefixes) {
      const idx = line.indexOf(prefix);
      if (idx !== -1) {
        const rest = line.substring(idx + prefix.length).trim();
        const file = extractFilePath(rest);
        if (file) files.add(file);
      }
    }
  }
  return Array.from(files);
}

function extractFilePath(text: string): string {
  // Match common file patterns
  const match = text.match(/[`"]?([\w./\-]+\.[a-zA-Z0-9]+)[`":]?/);
  if (match) return match[1];
  const simple = text.match(/^[\w./\-]+/);
  return simple ? simple[0] : '';
}

function extractLines(lines: string[], patterns: string[]): string[] {
  return lines.filter((line) => patterns.some((p) => line.includes(p))).slice(0, 20);
}

function extractKeySteps(lines: string[]): string[] {
  const stepPatterns = [
    'Running',
    'Installing',
    'Executing',
    'Applying',
    'Writing',
    'Creating',
    'Compiling',
    'Linting',
    'Testing',
    'git commit',
    'git push',
    'npm install',
  ];
  return lines
    .filter((line) => stepPatterns.some((p) => line.includes(p)))
    .slice(0, 10)
    .map((line) => line.trim());
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function getStatusEmoji(status: Status): string {
  return { RUNNING: '🟢', WAITING_INPUT: '🟡', COMPLETED: '🔵', ERROR: '🔴' }[status] || '⚪';
}
