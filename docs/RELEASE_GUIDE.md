# VibeWatcher v1.0 发布指南

## 发布前检查清单

### 1. 代码检查

- [ ] 所有 TypeScript 编译无错误
- [ ] 所有单元测试通过
- [ ] VSCode 扩展编译成功
- [ ] 清理所有 console.log 调试语句
- [ ] 检查代码中无敏感信息泄露

### 2. 版本一致性

- [ ] `vibewatcher-cli/package.json` version: 1.0.0
- [ ] `vibewatcher-server/package.json` version: 1.0.0
- [ ] `vibewatcher-vscode/package.json` version: 1.0.0
- [ ] `README.md` 版本号更新
- [ ] `CLAUDE.md` 版本状态更新

### 3. 文档检查

- [ ] README.md 包含所有功能说明
- [ ] 安装说明准确无误
- [ ] 命令参考完整
- [ ] 常见问题解答覆盖常见错误

### 4. VSCode 扩展准备

- [ ] 图标文件存在且符合规范 (128x128 PNG)
- [ ] package.json metadata 完整
- [ ] README.md 包含扩展说明 (VSCode 市场用)
- [ ] LICENSE 文件存在

### 5. GitHub Release 准备

- [ ] 创建 tag: `git tag v1.0.0`
- [ ] 编写 Release Notes
- [ ] 打包 .vsix 文件
- [ ] 上传到 GitHub Releases

## 发布命令

### 1. 更新版本号

```bash
# 在各 package.json 中更新 version
# vibewatcher-cli/package.json
# vibewatcher-server/package.json
# vibewatcher-vscode/package.json
```

### 2. 构建所有包

```bash
npm run build
```

### 3. 打包 VSCode 扩展

```bash
cd vibewatcher-vscode
vsce package
# 生成 vibewatcher-1.0.0.vsix
```

### 4. 提交代码

```bash
git add .
git commit -m "release: v1.0.0"
git tag v1.0.0
git push origin main --tags
```

### 5. 发布到 VSCode Marketplace

```bash
# 首次发布需要创建 publisher
# https://marketplace.visualstudio.com/manage/publishers/vibewatcher-dev

# 发布扩展
vsce publish

# 或通过 GitHub Actions 自动发布
```

### 6. 更新 GitHub Release

1. 访问 https://github.com/yandexuanxuan/VibeWatcher/releases/new
2. 选择 tag v1.0.0
3. 添加 Release Notes
4. 上传 .vsix 文件

## VSCode Marketplace README 要求

VSCode 扩展需要一个专门的 README.md，放置在 `vibewatcher-vscode/` 目录下：

```markdown
# VibeWatcher

## 概述

VibeWatcher 是 Claude Code 的执行监控扩展...

## 功能特性

- 状态栏实时显示运行状态
- 任务列表视图
- 桌面通知
- ...

## 安装

1. 从 VSCode Marketplace 安装
2. 重新加载窗口

## 系统要求

- Node.js >= 14.8
- Claude Code CLI
```
