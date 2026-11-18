# CodeInterviewAssist

> **语言 / Language**：[English](README.md) | **简体中文**

> ## ⚠️ 致社区的重要声明 ⚠️
>
> **本项目是一个免费的开源倡议，并非一套完整的商业服务！**
>
> 市面上有大量付费面试辅导工具，收费高达数百美元，提供实时音频采集、自动生成答案等全套功能。本项目与它们有本质区别：
>
> - 这是一个**小型的、非营利的、由社区驱动的项目**，背后没有任何经济动机
> - 全部代码均可自由获取，任何人可以使用、修改或扩展
> - 想要语音支持之类的功能？欢迎你自行接入 OpenAI Whisper 等 API
> - 新功能应当通过**社区贡献**来实现——要求唯一的维护者免费开发高级功能是不合理的
> - 维护者不会因此获得任何作品集收益、金钱报酬或名声
>
> **在提交功能请求或期待获得个性化支持之前，请先理解本项目纯粹是作为社区资源而存在。** 如果你认可已有的成果，最好的感谢方式就是贡献代码、文档，或者帮助其他用户。

> ## 🔑 API KEY 说明 - 已更新
>
> 我们已测试并确认：**Gemini 与 OpenAI 的 API 在当前版本下均可正常工作**。如果你的 API Key 出现问题：
>
> - 尝试从用户数据目录中的配置文件里删除你的 API Key 条目
> - 退出应用并重新登录
> - 检查你的 API Key 控制台，确认该 Key 处于启用状态且有足够额度
> - 确认你使用的是正确格式的 API Key（OpenAI 的 Key 以 "sk-" 开头）
>
> 配置文件位于：`C:\Users\[USERNAME]\AppData\Roaming\interview-coder-v1\config.json`（Windows）或 `/Users/[USERNAME]/Library/Application Support/interview-coder-v1/config.json`（macOS）

## 免费、开源的 AI 面试准备工具

本项目为付费编程面试平台提供了一个强大的替代方案：它以免费开源的形态，交付付费面试准备工具的核心功能。使用你自己的 OpenAI API Key，即可获得 AI 驱动的问题分析、方案生成与调试辅助等高级能力——全部在你的本机运行。

### 为什么要有这个项目

最好的编程面试工具往往被昂贵的付费墙挡在外面，许多学生和求职者因此无法使用。本项目以零成本提供同等强大的功能，让你能够：

- 使用自己的 API Key（只为实际用量付费）
- 所有内容都在本机运行，隐私完全由自己掌握
- 按自己的需求进行定制
- 从开源工具中学习，并参与贡献

### 可定制性

代码库在设计上就是可改造的：

- **AI 模型**：虽然当前使用 OpenAI 的模型，但你可以修改代码接入 Claude、Deepseek、Llama 等其他供应商，或任何提供 API 的模型。所有接入代码都在 `electron/ProcessingHelper.ts` 中，界面设置位于 `src/components/Settings/SettingsDialog.tsx`。
- **语言**：增加对更多编程语言的支持
- **功能**：以新的能力扩展原有功能
- **界面**：按你的偏好定制界面

这些只需要具备基本的 JavaScript/TypeScript 知识，并了解你要接入的 API 即可。

## 功能特性

- 🎯 99% 隐身：窗口无法被大多数屏幕捕获方式检测到
- 📸 智能截图：分别截取题目文字与代码，以获得更好的分析效果
- 🤖 AI 驱动的分析：基于 GPT-4o 自动提取并分析编程题目
- 💡 方案生成：获得详细讲解与解答，并附时间/空间复杂度分析
- 🔧 实时调试：在 AI 辅助下调试代码，并获得结构化反馈
- 🎨 高级窗口管理：可自由移动、缩放窗口，调整不透明度与缩放比例
- 🔄 模型选择：可在不同处理阶段分别选用 GPT-4o 与 GPT-4o-mini
- 🔒 注重隐私：除调用 OpenAI API 外，你的 API Key 与数据不会离开本机

## 全局快捷键

本应用使用无法被识别的全局键盘快捷键，浏览器和其他应用都无法检测到：

- 显示/隐藏窗口：[Control 或 Cmd + B]
- 移动窗口：[Control 或 Cmd + 方向键]
- 截图：[Control 或 Cmd + H]
- 删除最后一张截图：[Control 或 Cmd + L]
- 处理截图：[Control 或 Cmd + Enter]
- 开始新题目：[Control 或 Cmd + R]
- 退出：[Control 或 Cmd + Q]
- 降低不透明度：[Control 或 Cmd + []
- 提高不透明度：[Control 或 Cmd + ]]
- 缩小：[Control 或 Cmd + -]
- 重置缩放：[Control 或 Cmd + 0]
- 放大：[Control 或 Cmd + =]

## 隐身兼容性

本应用对以下场景不可见：

- 6.1.6（含）以下的 Zoom 版本
- 所有基于浏览器的屏幕录制软件
- 所有版本的 Discord
- macOS 的_截图_功能（Command + Shift + 3/4）

注意：本应用**并非**对以下场景不可见：

- 6.1.6 及以上的 Zoom 版本
  - https://zoom.en.uptodown.com/mac/versions （如需降级 Zoom，可从此处下载）
- macOS 原生的屏幕_录制_功能（Command + Shift + 5）

## 前置要求

- Node.js（v16 或更高版本）
- npm 或 bun 包管理器
- OpenAI API Key
- 授予终端/IDE 屏幕录制权限
  - 在 macOS 上：
    1. 打开系统设置 > 安全性与隐私 > 隐私 > 屏幕录制
    2. 确认已为 CodeInterviewAssist 开启屏幕录制权限
    3. 开启权限后重启 CodeInterviewAssist
  - 在 Windows 上：
    - 无需额外权限
  - 在 Linux 上：
    - 视发行版不同，可能需要 `xhost` 访问权限

## 运行应用

### 快速开始

1. 克隆仓库：

```bash
git clone https://github.com/greeneu/interview-coder-withoupaywall-opensource.git
cd interview-coder-withoupaywall-opensource
```

2. 安装依赖：

```bash
npm install
```

3. **推荐**：清理之前的构建产物：

```bash
npm run clean
```

4. 运行与你的平台对应的脚本：

**Windows：**
```bash
stealth-run.bat
```

**macOS/Linux：**
```bash
# Make the script executable first
chmod +x stealth-run.sh
./stealth-run.sh
```

**重要**：应用窗口默认是不可见的！请使用 Ctrl+B（Mac 上为 Cmd+B）切换显示状态。

### 构建可分发的安装包

如需制作可分发的安装包：

**macOS（DMG）：**
```bash
# Using npm
npm run package-mac

# Or using yarn
yarn package-mac
```

**Windows（安装程序）：**
```bash
# Using npm
npm run package-win

# Or using yarn
yarn package-win
```

打包后的应用会输出到 `release` 目录。

**脚本做了什么：**
- 创建应用所需的目录
- 清理之前的构建产物，确保从干净状态开始
- 以生产模式构建应用
- 以隐身模式启动应用

### 说明与故障排查

- **窗口管理器兼容性**：某些窗口管理工具（例如 macOS 上的 Rectangle Pro）可能干扰应用的窗口移动。可尝试临时关闭它们。

- **API 用量**：注意你的 OpenAI API Key 的速率限制与额度消耗。视觉（Vision）API 调用比纯文本调用更贵。

- **LLM 定制**：只需修改 `ProcessingHelper.ts` 及相关界面组件中的 API 调用，即可轻松接入 Claude、Deepseek、Grok 等 LLM。

- **常见问题**：
  - 启动应用前先执行 `npm run clean`，以获得全新的构建
  - 如果窗口没有出现，可多次按 Ctrl+B/Cmd+B
  - 如需要，可用 Ctrl+[/]/Cmd+[/] 调整窗口不透明度
  - macOS：确认脚本具有执行权限（`chmod +x stealth-run.sh`）

## 与付费面试工具的对比

| 功能 | 高级工具（付费） | CodeInterviewAssist（本项目） |
|---------|------------------------|----------------------------------------|
| 价格 | 每月 60 美元订阅 | 免费（只需为你的 API 用量付费） |
| 方案生成 | ✅ | ✅ |
| 调试辅助 | ✅ | ✅ |
| 隐身能力 | ✅ | ✅ |
| 多语言支持 | ✅ | ✅ |
| 时间/空间复杂度分析 | ✅ | ✅ |
| 窗口管理 | ✅ | ✅ |
| 账号体系 | 必需 | 无（已简化） |
| 支付流程 | 必需 | 无（使用你自己的 API Key） |
| 隐私 | 服务端处理 | 100% 本地处理 |
| 定制能力 | 受限 | 可获取全部源码 |
| 模型选择 | 受限 | 可在多个模型间选择 |

## 技术栈

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- Radix UI Components
- OpenAI API

## 工作原理

1. **初始设置**
   - 启动隐身窗口
   - 在设置中填入你的 OpenAI API Key
   - 为题目提取、方案生成与调试分别选择偏好的模型

2. **捕获题目**
   - 使用全局快捷键 [Control 或 Cmd + H] 对编程题截图
   - 截图会自动加入队列，队列最多容纳 2 张
   - 如需要，可用 [Control 或 Cmd + L] 删除最后一张截图

3. **处理**
   - 按 [Control 或 Cmd + Enter] 分析截图
   - AI 通过 GPT-4 Vision API 从截图中提取题目要求
   - 模型基于提取到的信息生成最优解法
   - 所有分析都使用你自己的 OpenAI API Key 完成

4. **解答与调试**
   - 查看生成的解答与详细讲解
   - 对报错信息或代码再次截图，即可使用调试功能
   - 获得结构化分析，包括定位到的问题、修正与优化建议
   - 按需在解答视图与队列视图之间切换

5. **窗口管理**
   - 使用 [Control 或 Cmd + 方向键] 移动窗口
   - 使用 [Control 或 Cmd + B] 切换显示状态
   - 使用 [Control 或 Cmd + [] 与 [Control 或 Cmd + ]] 调整不透明度
   - 窗口对指定的屏幕共享应用保持不可见
   - 使用 [Control 或 Cmd + R] 开始新题目

6. **语言选择**

   - 单击一次即可在编程语言之间切换
   - 使用方向键在可用语言之间进行键盘导航
   - 系统会动态适配代码库中新增或删除的语言
   - 你的语言偏好会在不同会话之间保留

## 添加更多 AI 模型

本应用在设计上考虑了可扩展性。你可以在现有 OpenAI 集成之外，轻松添加对其他 LLM 的支持：

- 可以加入 Claude、Deepseek、Grok 或任何其他 AI 模型作为备选
- 应用架构允许多个 LLM 后端共存
- 用户可以自由选择自己偏好的 AI 供应商

要添加新模型，只需扩展 `electron/ProcessingHelper.ts` 中的 API 集成，并在 `src/components/Settings/SettingsDialog.tsx` 中增加对应的界面选项。模块化设计让这一过程十分直接，且不会破坏现有功能。

## 配置

- **OpenAI API Key**：你的个人 API Key 保存在本地，仅用于调用 OpenAI 的 API
- **模型选择**：可为每个处理阶段在 GPT-4o 与 GPT-4o-mini 之间选择：
  - 题目提取：分析截图以理解编程题目
  - 方案生成：生成带讲解的优化解法
  - 调试：针对报错给出详细分析与改进建议
- **语言**：选择你解题时使用的编程语言
- **窗口控制**：使用快捷键调整不透明度、位置与缩放比例
- **所有设置都保存在本地**的用户数据目录中，并在不同会话之间保留

## 许可证

本项目基于 GNU Affero General Public License v3.0（AGPL-3.0）许可发布。

### 这意味着什么

- 你可以自由使用、修改和分发本软件
- 如果你修改了代码，必须以相同许可证公开你的改动
- 如果你在网络服务器上运行修改后的版本，必须向使用者提供源代码
- 我们非常鼓励你把改进回馈到主项目

条款摘要见 [LICENSE-SHORT](LICENSE-SHORT)；完整许可文本见 [GNU AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)。

### 参与贡献

我们欢迎各种贡献！详情请参见[贡献指南](CONTRIBUTING.zh-CN.md)。

## 免责声明与使用规范

本工具旨在作为学习辅助与实践帮手。虽然它能在面试过程中帮助你理解题目与解题思路，但请考虑以下准则：

- 如果面试中被直接问及，请如实说明你使用了辅助工具
- 用这个工具去学习概念，而不只是获取答案
- 要认识到理解解法比单纯呈现解法更有价值
- 在课后作业中，请确保你彻底理解了所提交的解答

请记住，技术面试的目的是评估你的问题解决能力与理解深度。只有在用来促进学习、而非替代学习时，这个工具才能发挥最好的效果。

## 支持与提问

如有疑问或需要支持，请在 GitHub 仓库中提交 issue。

---

> **请记住：** 这是社区资源。如果你觉得它有价值，与其只提需求，不如参与贡献。项目的成长依靠集体努力，而非个体的索取。
