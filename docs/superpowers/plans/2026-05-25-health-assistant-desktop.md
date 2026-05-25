# Health Assistant Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight Electron tray desktop health assistant inspired by moved-yet, with sit/drink reminders, progressive escalation, local stats, and a dark dashboard.

**Architecture:** Electron main process owns timers, tray, native notifications, persistence, and IPC. React renderer owns the dashboard/settings UI and sends user actions back to main. Shared TypeScript modules hold settings, stats, reminder engine, and health score logic so behavior can be tested independently.

**Tech Stack:** Electron, Vite, React, TypeScript, Vitest, CSS custom properties.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main/main.ts`
- Create: `src/preload/preload.ts`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/styles.css`

- [ ] Add npm scripts for `dev`, `build`, `test`, and `typecheck`.
- [ ] Configure Vite with React and separate Electron TS compilation.
- [ ] Add a minimal renderer shell that can be served by Vite.

### Task 2: Tested Core Domain

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/defaults.ts`
- Create: `src/shared/healthScore.ts`
- Create: `src/shared/reminderEngine.ts`
- Create: `src/shared/healthScore.test.ts`
- Create: `src/shared/reminderEngine.test.ts`

- [ ] Write failing tests for health score and next reminder calculations.
- [ ] Implement defaults, score logic, and reminder state helpers.
- [ ] Verify tests pass.

### Task 3: Persistence and Main Process

**Files:**
- Create: `src/main/store.ts`
- Modify: `src/main/main.ts`
- Modify: `src/preload/preload.ts`

- [ ] Persist settings and daily stats under Electron `userData`.
- [ ] Expose IPC methods for snapshot, settings update, confirm sit/drink, snooze, and reset.
- [ ] Start timers in the main process and emit state updates to renderer.

### Task 4: Tray, Notifications, Strong Reminder

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

- [ ] Add tray menu: show, pause/resume, reset timers, quit.
- [ ] Use native notifications for level-two reminders.
- [ ] Show an always-on-top strong reminder window/panel when escalation reaches level three.

### Task 5: Dashboard UI and Settings

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

- [ ] Build dark compact dashboard with countdowns, today stats, health score, timeline, and settings controls.
- [ ] Add actions: stood up, drank water, snooze, reset, pause/resume.
- [ ] Keep layout responsive and desktop-friendly.

### Task 6: Verification

**Files:**
- No new files.

- [ ] Run `npm install` if dependencies are missing.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Start the dev app and report the launch command/URL or desktop behavior.
