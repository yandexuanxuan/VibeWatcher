import { LLMProvider } from './llm';
import { Status } from 'vibewatcher-shared';

const SYSTEM_PROMPT = `You are an AI assistant analyzing VibeWatcher task execution logs.
VibeWatcher monitors Claude Code CLI execution. Tasks emit output lines (stdout/stderr).
Your job is to summarize what the task is doing, identify any potential issues, and estimate progress.
Keep your response concise (2-3 sentences max).`;

function buildPrompt(taskId: string, status: Status, outputLines: string[], keyword: string): string {
  const output = outputLines.slice(-30).join('\n');
  return `${SYSTEM_PROMPT}

Task ID: ${taskId}
Keyword: ${keyword}
Status: ${status}
Recent output:
${output}

Provide a brief interpretation of what this task is doing and any observations.`;
}

export class AIInterpreter {
  private provider: LLMProvider | null = null;

  constructor(provider: LLMProvider | null) {
    this.provider = provider;
  }

  setProvider(provider: LLMProvider | null): void {
    this.provider = provider;
  }

  isEnabled(): boolean {
    return this.provider !== null;
  }

  async interpret(
    taskId: string,
    status: Status,
    outputLines: string[],
    keyword: string
  ): Promise<string> {
    if (!this.provider) {
      return '[AI Interpreter not configured]';
    }

    const prompt = buildPrompt(taskId, status, outputLines, keyword);
    return this.provider.interpret(prompt);
  }
}