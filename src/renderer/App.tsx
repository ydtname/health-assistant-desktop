import { useEffect, useMemo, useState } from 'react';
import { calculateHealthScore, healthRating, healthSuggestions } from '../shared/healthScore.js';
import type { AppSnapshot, ReminderKind, ReminderSettings, UpdateStatus } from '../shared/types.js';

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function remaining(snapshot: AppSnapshot, kind: ReminderKind): number {
  return snapshot.clocks[kind].dueAt - snapshot.now;
}

function isStrongRoute(): ReminderKind | null {
  if (window.location.hash === '#strong-sit') {
    return 'sit';
  }
  if (window.location.hash === '#strong-drink') {
    return 'drink';
  }
  return null;
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
  const [strongKind] = useState<ReminderKind | null>(() => isStrongRoute());

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

  if (strongKind) {
    const title = strongKind === 'sit' ? '起来动一动' : '喝口水';
    const copy = strongKind === 'sit' ? '离开椅子两分钟，肩颈会感谢你。' : '补水不是打断，是给专注续航。';
    return (
      <main className="strong">
        <div className="pulse" />
        <p className="eyebrow">强提醒</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        <div className="actions">
          <button className="primary" onClick={() => void window.healthAssistant.confirm(strongKind)}>
            {strongKind === 'sit' ? '已起身' : '已喝水'}
          </button>
          <button onClick={() => void window.healthAssistant.snooze(strongKind)}>稍后提醒</button>
        </div>
      </main>
    );
  }

  const rating = healthRating(score);
  const suggestions = healthSuggestions(snapshot.stats);
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

  return (
    <main className="app">
      <section className="topbar">
        <div>
          <p className="eyebrow">Health Assistant</p>
          <h1>健康助手</h1>
        </div>
        <div className="topActions">
          <button onClick={() => void handleCheckUpdates()}>检查更新</button>
          <button className={snapshot.paused ? 'primary' : ''} onClick={() => void window.healthAssistant.togglePaused()}>
            {snapshot.paused ? '继续提醒' : '暂停提醒'}
          </button>
        </div>
      </section>
      {updateStatus && (
        <UpdatePanel
          status={updateStatus}
          onDownload={() => void handleDownloadUpdate()}
          onInstall={() => void handleInstallUpdate()}
        />
      )}

      <section className="hero">
        <div
          className="scoreRing"
          style={{ '--rating-color': rating.color, '--score': score } as React.CSSProperties}
        >
          <span>{score}</span>
          <small>{rating.label}</small>
        </div>
        <div className="heroCopy">
          <h2>{snapshot.paused ? '提醒已暂停' : '今天的节奏正在守住'}</h2>
          <p>{suggestions[0]}</p>
          <div className="actions">
            <button className="primary" onClick={() => void window.healthAssistant.confirm('sit')}>已起身</button>
            <button className="primary water" onClick={() => void window.healthAssistant.confirm('drink')}>已喝水</button>
            <button onClick={() => void window.healthAssistant.reset()}>重置计时器</button>
          </div>
        </div>
      </section>

      <section className="grid">
        <TimerCard
          label="久坐提醒"
          accent="move"
          enabled={snapshot.settings.sitEnabled}
          time={formatRemaining(remaining(snapshot, 'sit'))}
          level={snapshot.clocks.sit.escalationLevel}
          onSnooze={() => void window.healthAssistant.snooze('sit')}
        />
        <TimerCard
          label="喝水提醒"
          accent="water"
          enabled={snapshot.settings.drinkEnabled}
          time={formatRemaining(remaining(snapshot, 'drink'))}
          level={snapshot.clocks.drink.escalationLevel}
          onSnooze={() => void window.healthAssistant.snooze('drink')}
        />
        <StatCard label="今日起身" value={`${snapshot.stats.sitCount}`} unit="次" />
        <StatCard label="今日喝水" value={`${snapshot.stats.drinkCount}`} unit="次" />
        <StatCard label="专注时长" value={`${Math.floor(snapshot.stats.workMinutes / 60)}h ${snapshot.stats.workMinutes % 60}m`} unit="" />
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>提醒设置</h2>
        </div>
        <SettingsForm settings={snapshot.settings} />
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">Today</p>
          <h2>今日记录</h2>
        </div>
        <div className="timeline">
          {snapshot.stats.records.slice(-8).reverse().map(record => (
            <div className="record" key={record.id}>
              <span>{record.kind === 'sit' ? '起身' : '喝水'}</span>
              <small>{record.action === 'confirmed' ? '已完成' : '稍后'} · {new Date(record.timestamp).toLocaleTimeString()}</small>
            </div>
          ))}
          {snapshot.stats.records.length === 0 && <p className="muted">还没有记录，下一次提醒会出现在这里。</p>}
        </div>
      </section>
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

function TimerCard(props: {
  label: string;
  accent: 'move' | 'water';
  enabled: boolean;
  time: string;
  level: number;
  onSnooze: () => void;
}) {
  return (
    <article className={`timer ${props.accent}`}>
      <div>
        <p className="eyebrow">{props.enabled ? `Level ${props.level}` : 'Off'}</p>
        <h3>{props.label}</h3>
      </div>
      <strong>{props.time}</strong>
      <button onClick={props.onSnooze}>稍后</button>
    </article>
  );
}

function StatCard(props: { label: string; value: string; unit: string }) {
  return (
    <article className="stat">
      <p>{props.label}</p>
      <strong>{props.value}</strong>
      {props.unit && <span>{props.unit}</span>}
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
        <span>久坐间隔</span>
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
        <span>久坐提醒</span>
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
