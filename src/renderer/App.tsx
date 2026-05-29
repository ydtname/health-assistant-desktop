import { useEffect, useMemo, useRef, useState } from 'react';
import {
  completeActionFeedback,
  getActionFeedback,
  startActionFeedback,
  type ActionFeedback
} from '../shared/actionFeedback.js';
import { getFloatingAssistantStatus } from '../shared/floatingAssistant.js';
import { calculateHealthScore, healthRating, healthSuggestions } from '../shared/healthScore.js';
import type { AppSnapshot, ReminderKind, ReminderSettings, UpdateStatus } from '../shared/types.js';

type DockSide = 'left' | 'right';

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function remaining(snapshot: AppSnapshot, kind: ReminderKind): number {
  return snapshot.clocks[kind].dueAt - snapshot.now;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dockedSide, setDockedSide] = useState<DockSide | null>(null);
  const collapseTimer = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  const expandedRef = useRef(false);
  const dragState = useRef<{ lastX: number; lastY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  const clearCollapseTimer = () => {
    if (collapseTimer.current !== null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  };

  const setActionExpanded = (nextExpanded: boolean) => {
    clearCollapseTimer();
    expandedRef.current = nextExpanded;
    setExpanded(nextExpanded);
    if (!nextExpanded) {
      setSettingsOpen(false);
    }
    void window.healthAssistant.setFloatingExpanded(nextExpanded || hoveredRef.current);
  };

  const handleMouseEnter = () => {
    if (dockedSide) {
      return;
    }
    clearCollapseTimer();
    hoveredRef.current = true;
    setLeaving(false);
    setHovered(true);
    void window.healthAssistant.setFloatingExpanded(true);
  };

  const handleMouseLeave = () => {
    if (dockedSide) {
      return;
    }
    hoveredRef.current = false;
    if (!expandedRef.current) {
      setLeaving(true);
      collapseTimer.current = window.setTimeout(() => {
        collapseTimer.current = null;
        setHovered(false);
        setLeaving(false);
        void window.healthAssistant.setFloatingExpanded(false);
      }, 180);
    }
  };

  useEffect(() => {
    return () => clearCollapseTimer();
  }, []);

  useEffect(() => {
    if (!window.healthAssistant) {
      setError('桌面桥接未加载，请重新运行 npm run dev。');
      return undefined;
    }

    void window.healthAssistant.getSnapshot().then(setSnapshot).catch(reason => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
    const offSnapshot = window.healthAssistant.onSnapshot(setSnapshot);
    const offUpdateStatus = window.healthAssistant.onUpdateStatus(setUpdateStatus);
    return () => {
      offSnapshot();
      offUpdateStatus();
    };
  }, []);

  const score = useMemo(() => {
    if (!snapshot) {
      return 0;
    }
    return calculateHealthScore(snapshot.stats);
  }, [snapshot]);

  if (error) {
    return (
      <main className="app loading">
        <section className="panel errorPanel">
          <p className="eyebrow">启动异常</p>
          <h1>健康助手没有加载成功</h1>
          <p className="muted">{error}</p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return <main className="app loading">加载健康节奏...</main>;
  }

  const rating = healthRating(score);
  const suggestions = healthSuggestions(snapshot.stats);
  const floatingStatus = getFloatingAssistantStatus(snapshot);
  const sitFeedback = getActionFeedback(actionFeedback, 'sit', '已起身');
  const drinkFeedback = getActionFeedback(actionFeedback, 'drink', '已喝水');

  const handleConfirm = async (kind: ReminderKind) => {
    setActionFeedback(current => startActionFeedback(current, kind));
    try {
      const nextSnapshot = await window.healthAssistant.confirm(kind);
      setSnapshot(nextSnapshot);
      setActionFeedback(current => completeActionFeedback(current));
      window.setTimeout(() => {
        setActionFeedback(null);
        setActionExpanded(false);
      }, 650);
    } catch (reason) {
      setActionFeedback(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const handleCheckUpdates = async () => {
    const result = await window.healthAssistant.checkForUpdates();
    setUpdateStatus(result as UpdateStatus);
  };

  const handleDownloadUpdate = async () => {
    const result = await window.healthAssistant.downloadUpdate();
    setUpdateStatus(result);
  };

  const handleInstallUpdate = async () => {
    const result = await window.healthAssistant.installUpdate();
    setUpdateStatus(result);
  };

  const handleSnooze = async () => {
    await window.healthAssistant.snooze(floatingStatus.kind);
    setActionExpanded(false);
  };

  const handleOrbPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || expanded) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { lastX: event.screenX, lastY: event.screenY, moved: false };
  };

  const handleOrbPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = dragState.current;
    if (!current) {
      return;
    }
    const delta = { x: event.screenX - current.lastX, y: event.screenY - current.lastY };
    if (Math.abs(delta.x) + Math.abs(delta.y) < 1) {
      return;
    }
    current.lastX = event.screenX;
    current.lastY = event.screenY;
    current.moved = true;
    clearCollapseTimer();
    hoveredRef.current = false;
    setHovered(false);
    void window.healthAssistant.dragFloatingBy(delta);
  };

  const handleOrbPointerUp = async (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = dragState.current;
    dragState.current = null;
    if (!current) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.moved) {
      suppressClickRef.current = true;
      const nextDockedSide = await window.healthAssistant.finishFloatingDrag();
      setDockedSide(nextDockedSide);
      if (nextDockedSide) {
        hoveredRef.current = false;
        expandedRef.current = false;
        setHovered(false);
        setLeaving(false);
        setExpanded(false);
        setSettingsOpen(false);
      }
    }
  };

  const handleOrbClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setActionExpanded(!expanded);
  };

  const handleEdgeClick = async () => {
    setDockedSide(null);
    await window.healthAssistant.undockFloating();
  };

  return (
    <main className={`app floatingMode ${expanded ? 'isExpanded' : ''} ${dockedSide ? `isDocked docked-${dockedSide}` : ''}`}>
      <section className="floatingAssistant" aria-label="健康助手悬浮球" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {dockedSide && (
          <button className="edgeTab" aria-label="展开健康助手" onClick={() => void handleEdgeClick()}>
            <span />
          </button>
        )}

        {!expanded && hovered && (
          <div className={leaving ? 'infoPanel isLeaving' : 'infoPanel'}>
            <div>
              <p className="eyebrow">Health Assistant</p>
              <h1>{snapshot.paused ? '提醒已暂停' : floatingStatus.label}</h1>
              <p className="muted">{suggestions[0]}</p>
            </div>

            <div className="miniGrid">
              <MiniTimer label="起身" time={formatRemaining(remaining(snapshot, 'sit'))} active={floatingStatus.kind === 'sit'} />
              <MiniTimer label="喝水" time={formatRemaining(remaining(snapshot, 'drink'))} active={floatingStatus.kind === 'drink'} />
            </div>

            <div className="miniStats">
              <span>{floatingStatus.isDue ? '现在处理' : '下次提醒'}</span>
              <span>{rating.label}</span>
              <span>起身 {snapshot.stats.sitCount} 次</span>
              <span>喝水 {snapshot.stats.drinkCount} 次</span>
            </div>
          </div>
        )}

        <button
          className={`orb ${floatingStatus.tone} ${floatingStatus.isDue ? 'due' : ''}`}
          type="button"
          aria-expanded={expanded}
          aria-label="打开健康操作"
          onPointerDown={handleOrbPointerDown}
          onPointerMove={handleOrbPointerMove}
          onPointerUp={event => void handleOrbPointerUp(event)}
          onClick={handleOrbClick}
        >
          <span className="orbScore">{score}</span>
          <span className="orbLabel">{snapshot.paused ? '暂停' : formatRemaining(floatingStatus.remainingMs)}</span>
        </button>

        {expanded && (
          <div className="actionPanel">
            <button className="closeButton" aria-label="收起" onClick={() => setActionExpanded(false)}>
              ×
            </button>
            <div>
              <p className="eyebrow">Quick Actions</p>
              <h2>{floatingStatus.label}</h2>
            </div>
            <div className="actionDock">
              <button className="primary water" disabled={drinkFeedback.disabled} onClick={() => void handleConfirm('drink')}>
                {drinkFeedback.label}
              </button>
              <button className="primary" disabled={sitFeedback.disabled} onClick={() => void handleConfirm('sit')}>
                {sitFeedback.label}
              </button>
              <button onClick={() => void handleSnooze()}>稍后</button>
              <button className="iconButton" aria-label="设置" onClick={() => setSettingsOpen(current => !current)}>设置</button>
            </div>
          </div>
        )}
      </section>

      {updateStatus && (
        <UpdatePanel
          status={updateStatus}
          onDownload={() => void handleDownloadUpdate()}
          onInstall={() => void handleInstallUpdate()}
        />
      )}

      {settingsOpen && (
        <section className="panel settingsPanel">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>提醒设置</h2>
          </div>
          <div className="compactActions">
            <button className={snapshot.paused ? 'primary' : ''} onClick={() => void window.healthAssistant.togglePaused()}>
              {snapshot.paused ? '继续提醒' : '暂停提醒'}
            </button>
            <button onClick={() => void window.healthAssistant.reset()}>重置计时器</button>
            <button onClick={() => void handleCheckUpdates()}>检查更新</button>
          </div>
          <SettingsForm settings={snapshot.settings} />
        </section>
      )}

    </main>
  );
}

function UpdatePanel(props: {
  status: UpdateStatus;
  onDownload: () => void;
  onInstall: () => void;
}) {
  const progress = props.status.progress;
  const percent = progress ? Math.round(progress.percent) : 0;
  const canDownload = props.status.status === 'available';
  const canInstall = props.status.status === 'downloaded';
  const isDownloading = props.status.status === 'downloading';

  return (
    <section className={`notice updateNotice ${props.status.status}`}>
      <div className="updateCopy">
        <p>{props.status.message}</p>
        {progress && (
          <small>
            {formatBytes(progress.transferred)} / {formatBytes(progress.total)} · {formatSpeed(progress.bytesPerSecond)}
          </small>
        )}
      </div>
      {(isDownloading || progress) && (
        <div className="progressTrack" aria-label="更新下载进度">
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      <div className="updateActions">
        {isDownloading && <strong>{percent}%</strong>}
        {canDownload && <button className="primary" onClick={props.onDownload}>下载更新</button>}
        {canInstall && <button className="primary" onClick={props.onInstall}>立即安装</button>}
      </div>
    </section>
  );
}

function MiniTimer(props: { label: string; time: string; active: boolean }) {
  return (
    <article className={props.active ? 'miniTimer active' : 'miniTimer'}>
      <span>{props.label}</span>
      <strong>{props.time}</strong>
    </article>
  );
}

function SettingsForm({ settings }: { settings: ReminderSettings }) {
  const update = (patch: Partial<ReminderSettings>) => {
    void window.healthAssistant.updateSettings(patch);
  };

  return (
    <div className="settings">
      <label>
        <span>起身间隔</span>
        <input
          type="number"
          min="5"
          value={settings.sitIntervalMinutes}
          onChange={event => update({ sitIntervalMinutes: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>喝水间隔</span>
        <input
          type="number"
          min="5"
          value={settings.drinkIntervalMinutes}
          onChange={event => update({ drinkIntervalMinutes: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>稍后分钟</span>
        <input
          type="number"
          min="1"
          value={settings.snoozeMinutes}
          onChange={event => update({ snoozeMinutes: Number(event.target.value) })}
        />
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.sitEnabled}
          onChange={event => update({ sitEnabled: event.target.checked })}
        />
        <span>起身提醒</span>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.drinkEnabled}
          onChange={event => update({ drinkEnabled: event.target.checked })}
        />
        <span>喝水提醒</span>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.launchHidden}
          onChange={event => update({ launchHidden: event.target.checked })}
        />
        <span>启动后隐藏</span>
      </label>
    </div>
  );
}
