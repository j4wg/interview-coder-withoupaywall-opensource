# 参与贡献 Interview Coder - Unlocked Edition

感谢你有兴趣为 Interview Coder - Unlocked Edition 贡献代码！这个免费的开源工具旨在为编程社区提供易获取的面试准备资源，你的付出能让它变得更好。很高兴你能加入这段协作之旅！

> **语言 / Language**：[English](CONTRIBUTING.md) | **简体中文**

## 我们的社区价值观

我们基于以下原则，营造一个互相支持、包容的环境：

- **协作开发**：携手合作才能让我们更强大——避免重复劳动，把各自的能力汇聚起来。
- **开放获取**：这个工具属于所有人，我们希望它保持免费，让每个需要它的人都能用上。
- **持续改进**：每一份贡献，无论大小，都能让 AI 分析、隐身能力和调试辅助等功能更加完善。

## 如何开始

### 1. Fork 仓库

- 访问仓库 [github.com/Ornithopter-pilot/interview-coder-withoupaywall-opensource](https://github.com/Ornithopter-pilot/interview-coder-withoupaywall-opensource)。
- 点击 "Fork" 按钮，创建你自己的副本。
- 将你的 fork 克隆到本地：
  ```bash
  git clone https://github.com/YOUR-USERNAME/interview-coder-withoupaywall-opensource.git
  ```
- 配置上游远端，以便与原仓库同步：
  ```bash
  git remote add upstream https://github.com/Ornithopter-pilot/interview-coder-withoupaywall-opensource.git
  ```

### 2. 创建分支

- 为你的工作创建一个名字清晰的分支：
  ```bash
  git checkout -b feature/your-feature-name
  ```
- 示例：`feature/add-python-support`、`bugfix/fix-screenshot-capture`。
- 让每个分支只聚焦一个功能或修复，以便评审更高效。

### 3. 修改并测试

- 在代码库中实现你的改进或修复（例如 `electron/ProcessingHelper.ts`、`src/components/Settings/SettingsDialog.tsx`）。
- 充分测试，尤其是截图捕获、AI 集成这类功能，确保兼容 macOS、Windows 与 Linux。
- 遵循现有的代码风格（TypeScript、React、Tailwind CSS），并运行：

### 4. 提交并推送

- 用清晰的提交信息提交你的改动：
  ```bash
  git commit -m "feat: add Python language support with detailed testing"
  ```
- 推送到你的 fork：
  ```bash
  git push origin feature/your-feature-name
  ```

### 5. 提交 Pull Request（PR）

- 进入原仓库，点击 "New Pull Request"。
- 选择你的分支并创建 PR。
- 提供详细的描述：
  - 它解决了什么问题？
  - 你如何测试的？
  - 关联相关的 issue（例如 `Fixes #123`）。
- 如适用，指派评审人（例如 `@anshumansingh01`、`@bhaumikmaan`）。

## 贡献规范

为确保协作顺畅且质量可控，请遵循以下规范：

### 代码质量

- 编写清晰、注释充分的代码。复杂逻辑（例如 `ProcessingHelper.ts` 中的 AI 模型集成）请添加注释。
- 使用仓库自带的 `stealth-run.sh` 或 `stealth-run.bat` 脚本在本地测试你的改动。
- 避免破坏已有功能（例如隐身能力、截图捕获）。

### PR 流程

- 按照我们的分支保护规则，所有改动都必须通过 PR 提交到主分支。
- PR 需要 2 个批准评审，其中最新一次推送还需获得一次独立批准（由推送者以外的人给出）。
- 合并前需解决所有与代码相关的讨论——未解决的反馈会阻塞 PR。
- 如果推送了新的提交，旧的批准会被作废，以确保评审反映最新代码。

## 许可与署名

本项目基于 GNU Affero General Public License v3.0（AGPL-3.0）许可发布。作为贡献者：

- **回馈社区**：把你的改进以 PR 形式提交到主仓库，让社区受益。
- **开放共享**：如果你修改并部署了本软件（例如部署在服务器上），必须以 AGPL-3.0 向使用者提供源代码。
- **保留署名**：在你的修改中保留原有的版权声明与许可证文本。

## 社区礼仪

- 在评论与评审中保持尊重与建设性。
- 主动评审他人的 PR，分担工作量——你的意见很有价值！
- 通过提交 issue 报告缺陷或提出功能建议时，请包含：
  - 清晰的标题。
  - 复现步骤。
  - 预期行为与实际行为的对比。

## 开发提示

- **环境准备**：确认已安装 Node.js（v16+）与 npm/bun。授予屏幕录制权限（详见 README.md）。
- **API 用量**：测试 AI 功能时，请注意 OpenAI API 的费用。
- **故障排查**：遇到问题时，在构建前执行 `npm run clean`，并用 Ctrl+B/Cmd+B 切换窗口显示状态。

## 维护者说明

作为主要维护者，我（Ornithopter-pilot）负责合并与稳定性。你的 PR 会得到评审，但质量维护需要你的配合。请注意：

- 如果 PR 比较紧急，请 @ 我（@Ornithopter-pilot）。
- 请保持耐心——PR 数量较多时响应可能延迟。

## 谢谢你！

你的贡献让 Interview Coder - Unlocked Edition 成为一个强大且属于社区的工具。无论是添加语言支持、优化界面还是修复缺陷，每一份努力都很重要。让我们一起把它做得更好！
