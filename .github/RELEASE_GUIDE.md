# GitHub Release 发布指南

本文档说明如何在 GitHub 上发布 AgentMX 的新版本。

## 方法 1：通过 GitHub Web 界面（推荐）

### 步骤 1：访问 Releases 页面

1. 打开你的 GitHub 仓库
2. 点击页面右侧的 **"Releases"** 链接
3. 点击 **"Draft a new release"** 按钮

### 步骤 2：选择 Tag

- 在 "Choose a tag" 下拉框中选择 **`v0.1.0`**
- 这个 tag 已经通过 `git push origin v0.1.0` 推送到远程

### 步骤 3：填写 Release 信息

- **Release title**: `AgentMX v0.1.0 - Core Foundation`
- **Description**: 复制 `.github/RELEASE_v0.1.0.md` 的内容
  - 打开文件：`.github/RELEASE_v0.1.0.md`
  - 全选复制内容
  - 粘贴到 GitHub 的描述框中

### 步骤 4：添加附件（可选）

如果需要，可以添加以下文件作为附件：
- 构建好的 MCP Server 包
- 示例配置文件
- 快速开始指南 PDF

### 步骤 5：发布选项

- ✅ 勾选 **"Set as the latest release"**（设为最新版本）
- ⚠️ 如果这是预发布版本，勾选 "Set as a pre-release"
- ⚠️ 如果还在测试，可以先 "Save draft" 保存草稿

### 步骤 6：发布

- 点击 **"Publish release"** 按钮
- 发布后，GitHub 会自动：
  - 创建 release 页面
  - 生成源代码压缩包（.zip 和 .tar.gz）
  - 发送通知给 watchers

---

## 方法 2：通过 GitHub CLI（需要安装）

如果你安装了 GitHub CLI (`gh`)，可以使用命令行发布：

```bash
# 安装 GitHub CLI
# Windows: winget install --id GitHub.cli
# macOS: brew install gh
# Linux: 见 https://github.com/cli/cli#installation

# 登录 GitHub
gh auth login

# 创建 release
gh release create v0.1.0 \
  --title "AgentMX v0.1.0 - Core Foundation" \
  --notes-file .github/RELEASE_v0.1.0.md \
  --latest

# 如果需要上传附件
gh release upload v0.1.0 path/to/file.zip
```

---

## 方法 3：通过 GitHub API（高级）

使用 GitHub REST API 创建 release：

```bash
# 需要 GitHub Personal Access Token
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/AgentMX/releases \
  -d '{
    "tag_name": "v0.1.0",
    "name": "AgentMX v0.1.0 - Core Foundation",
    "body": "Release notes here...",
    "draft": false,
    "prerelease": false
  }'
```

---

## 发布后的检查清单

发布完成后，确认以下内容：

- [ ] Release 页面显示正确
- [ ] Tag `v0.1.0` 已关联到 release
- [ ] 源代码压缩包已自动生成
- [ ] Release 标记为 "Latest"
- [ ] 描述格式正确，链接可点击
- [ ] 如果有附件，确认已上传

---

## 发布后的推广

1. **更新 README.md**
   - 确认版本徽章显示 v0.1.0
   - 确认安装说明指向正确的 release

2. **社交媒体**
   - 在 Twitter/X 上宣布发布
   - 在相关社区分享（Reddit, Hacker News 等）

3. **文档网站**
   - 如果有文档网站，更新版本信息
   - 添加 v0.1.0 到版本选择器

4. **通知用户**
   - 发送邮件通知（如果有邮件列表）
   - 在 Discord/Slack 社区公告

---

## 常见问题

### Q: 如何编辑已发布的 release？

A: 在 Releases 页面找到对应版本，点击右上角的 "Edit release" 按钮。

### Q: 如何删除 release？

A: 在编辑页面底部有 "Delete this release" 按钮。注意：这不会删除 git tag。

### Q: 如何删除 tag？

```bash
# 删除本地 tag
git tag -d v0.1.0

# 删除远程 tag
git push origin :refs/tags/v0.1.0
```

### Q: Release 和 Tag 有什么区别？

- **Tag**: Git 版本标记，标记代码的特定提交
- **Release**: GitHub 功能，基于 tag 创建，包含发布说明、附件等

### Q: 可以修改已发布的 tag 吗？

A: 不推荐。如果必须修改，需要：
1. 删除远程 tag
2. 删除 release
3. 创建新 tag
4. 重新发布 release

---

## 下一个版本

准备发布 v0.2.0 时：

1. 更新 `package.json` 版本号
2. 更新 `CHANGELOG.md`
3. 创建新的 git tag: `git tag -a v0.2.0 -m "..."`
4. 推送 tag: `git push origin v0.2.0`
5. 创建新的 release 描述文件
6. 在 GitHub 上发布

---

**当前版本**: v0.1.0  
**发布日期**: 2026-05-19  
**发布者**: AgentMX Contributors
