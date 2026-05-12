import { WebviewPanel, window } from 'vscode';

const MAX_LINES = 20;

export class MiniPanel {
  private panel: WebviewPanel | null = null;
  private lines: string[] = [];

  show(): void {
    if (this.panel) {
      this.panel.reveal(window.activeTextEditor?.viewColumn);
      return;
    }

    this.panel = window.createWebviewPanel(
      'vibewatcher.mini',
      'VibeWatcher Output',
      { viewColumn: window.activeTextEditor?.viewColumn || 1, preserveFocus: true },
      {
        retainContextWhenHidden: true,
        enableScripts: false,
      }
    );

    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => {
      this.panel = null;
      this.lines = [];
    });
  }

  toggle(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
      this.lines = [];
    } else {
      this.show();
    }
  }

  appendOutput(text: string): void {
    const newLines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    this.lines.push(...newLines);
    if (this.lines.length > MAX_LINES) {
      this.lines = this.lines.slice(-MAX_LINES);
    }
    if (this.panel) {
      this.panel.webview.html = this.getHtml();
    }
  }

  clear(): void {
    this.lines = [];
    if (this.panel) {
      this.panel.webview.html = this.getHtml();
    }
  }

  private getHtml(): string {
    const lines = this.lines.length > 0
      ? this.lines.map((line) => `<div class="line">${this.escapeHtml(line)}</div>`).join('')
      : '<div class="empty">Waiting for output...</div>';

    return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    padding: 8px;
    height: 100vh;
    overflow: hidden;
  }
  .line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.5;
    padding: 0 4px;
  }
  .line:hover {
    background: #2d2d2d;
    cursor: pointer;
  }
  .empty {
    color: #606060;
    text-align: center;
    margin-top: 20px;
  }
  #container {
    height: 100%;
    overflow-y: auto;
  }
  #container::-webkit-scrollbar { width: 6px; }
  #container::-webkit-scrollbar-track { background: #1e1e1e; }
  #container::-webkit-scrollbar-thumb { background: #424242; border-radius: 3px; }
</style>
</head>
<body>
<div id="container">${lines}</div>
<script>
  // Auto-scroll to bottom on new content
  const container = document.getElementById('container');
  if (container) container.scrollTop = container.scrollHeight;
</script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
