# 健康助手桌面端

一个轻量级 Windows 桌面健康提醒应用，用于在长时间工作时提醒起身活动和补水。应用基于 Electron、React、Vite 与 TypeScript 构建，支持托盘常驻、提醒升级、今日记录统计和应用内更新检查。

## 功能特性

- 久坐提醒：按设定间隔提醒起身活动。
- 喝水提醒：按设定间隔提醒补水。
- 强提醒窗口：提醒升级后在屏幕右下角弹出置顶提醒。
- 托盘常驻：关闭主窗口后隐藏到系统托盘，可从托盘重新打开、暂停提醒、重置计时器或退出应用。
- 今日统计：展示今日起身次数、喝水次数、专注时长和最近记录。
- 健康评分：根据今日行为生成健康评分、评级与建议。
- 提醒设置：可调整久坐、喝水、稍后提醒和提醒升级间隔。
- 自动更新：支持通过 GitHub Releases 检查、下载和安装 Windows 更新包。

## 技术栈

- Electron 33
- React 19
- Vite 6
- TypeScript 5
- Vitest
- electron-builder

## 环境要求

- Node.js：建议使用当前 LTS 版本。
- npm：随 Node.js 安装。
- Windows 10 或更高版本用于桌面端运行与打包验证。

## 快速开始

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

开发命令会先停止可能残留的本地开发进程，然后编译 Electron 主进程和 preload 脚本，同时启动 Vite 与 Electron。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发环境。 |
| `npm run stop:dev` | 停止可能残留的开发进程。 |
| `npm run compile:electron` | 编译 Electron 主进程和 preload 代码。 |
| `npm run build` | 编译 Electron 代码并构建渲染端产物。 |
| `npm run dist:win` | 构建 Windows NSIS 安装包与 portable 包。 |
| `npm run publish:win` | 构建 Windows NSIS 安装包并发布到配置的 GitHub Releases。 |
| `npm run test` | 运行 Vitest 测试。 |
| `npm run typecheck` | 运行 TypeScript 类型检查。 |

## 项目结构

```text
src/
  main/        Electron 主进程、托盘、窗口、提醒调度、更新逻辑
  preload/     安全暴露给渲染进程的桌面桥接能力
  renderer/    React 界面与样式
  shared/      主进程与渲染进程共享的类型、提醒引擎、评分和工具函数
scripts/       开发辅助脚本
```

## 默认提醒配置

应用默认启用久坐提醒和喝水提醒：

- 久坐提醒间隔：60 分钟
- 喝水提醒间隔：45 分钟
- 一级提醒升级间隔：5 分钟
- 二级提醒升级间隔：5 分钟
- 稍后提醒间隔：10 分钟
- 启动后隐藏主窗口：关闭

这些默认值定义在 `src/shared/defaults.ts`，运行时可在应用的提醒设置中调整。

## 开发说明

### 窗口与托盘行为

- 主窗口关闭时不会直接退出应用，而是隐藏到系统托盘。
- 托盘单击可重新打开主窗口。
- 托盘菜单提供打开应用、暂停或继续提醒、重置计时器、检查更新和退出应用。

### 提醒流程

- 应用维护久坐与喝水两类提醒时钟。
- 用户确认完成后会记录到今日统计，并重置对应提醒时钟。
- 用户选择稍后提醒后，会按稍后提醒间隔重新安排提醒。
- 提醒升级后会弹出置顶强提醒窗口。

### 更新发布

自动更新使用 `electron-updater`，发布源配置为 GitHub：

- owner：`ydtname`
- repo：`health-assistant-desktop`

发布 Windows 安装包前，请确保 GitHub Releases 权限与发布凭据已正确配置。

## 测试与质量检查

提交前建议至少运行：

```bash
npm run typecheck
npm run test
npm run build
```

如果只修改共享逻辑或工具函数，也应同步补充或更新对应的 Vitest 测试。

## 构建产物

Windows 打包输出目录为 `release/`，构建配置位于 `package.json` 的 `build` 字段中。当前 Windows 目标包括：

- NSIS 安装包
- portable 便携包

## 许可证

当前仓库未声明许可证。如需开源或分发，请先补充明确的 LICENSE 文件。
