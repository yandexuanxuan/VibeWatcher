# 贡献指南

感谢你考虑为 VibeWatcher 贡献代码！

## 开发环境设置

```bash
# 克隆项目
git clone https://github.com/yandexuanxuan/VibeWatcher.git
cd VibeWatcher

# 安装依赖
cd vibewatcher-cli && npm install && cd ..
cd vibewatcher-server && npm install && cd ..
cd vibewatcher-vscode && npm install && cd ..

# 切换到 Node 20
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

# 构建
npm run build
```

## 开发工作流

### 1. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

### 2. 开发 & 测试

```bash
# 开发时运行测试
cd vibewatcher-cli && npm test
cd vibewatcher-server && npm test

# 构建 VSCode 扩展
cd vibewatcher-vscode && npm run compile
```

### 3. 提交代码

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
git commit -m "feat(cli): add new feature"
git commit -m "fix(server): resolve issue"
git commit -m "docs(readme): update installation guide"
```

### 4. 推送 & 创建 PR

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

## 代码规范

- 使用 TypeScript strict mode
- 所有公共 API 需要类型注解
- 运行 `npm test` 确保测试通过
- 更新相关文档

## 分支命名

- `feature/` - 新功能
- `fix/` - Bug 修复
- `refactor/` - 代码重构
- `docs/` - 文档更新
- `test/` - 测试相关

## 报告问题

请使用 [Issue Templates](.github/ISSUE_TEMPLATE/) 创建问题报告。

---

再次感谢你的贡献！
