# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-05-12

### Added
- **Stall Detection** — Tasks with no output for 5+ minutes now trigger automatic alerts. Configurable via `~/.vibewatch/config.json`.
- **AI Interpreter** — Pluggable LLM provider (Claude API, OpenAI, Ollama) to analyze task output and generate human-readable summaries. Enable in config.
- **CI/CD** — GitHub Actions workflows for automated testing (PR/push) and release publishing.
- **Shared Types Package** — `vibewatcher-shared` package with npm workspaces, eliminating duplicated `types.ts` across packages.
- **Jest Version Alignment** — Server package upgraded to Jest 29 for consistency across all packages.

### Changed
- All packages updated to version `0.2.0`
- VSCode extension package.json updated with repository, license, and keywords fields
- README updated with marketplace install instructions and new feature badges

## [0.2.0] - 2026-05-12

### Added
- **Execution Summary** — Auto-generate Markdown summary after task completion with file changes, TODOs, and key output
- **Duration Prediction** — Weighted average with time-decay (24h half-life) for estimating remaining task time
- **Mobile Notifications** — ServerChan (WeChat), Telegram Bot, and Slack Webhook integration
- **Mini Output Panel** — Always-on-top WebviewPanel with real-time output scrolling
- **VSCode WebSocket Reconnection** — Extension now auto-reconnects (5 retries with exponential backoff) if connection drops

### Changed
- WebSocket client in VSCode extension now has reconnection logic matching CLI behavior

## [0.1.0] - 2026-05-12

### Added
- **CLI Wrapper** — `vibewatch` and `claude-code` binaries for transparent interception
- **WebSocket Event Server** — Port 9234, auto-increment on conflict
- **VSCode Extension** — StatusBar, TreeView task list, desktop notifications
- **Prompt Detection** — Regex patterns for `proceed?`, `y/n`, `continue?`, etc.
- **State Management** — TaskManager + StateStore with event listener pattern