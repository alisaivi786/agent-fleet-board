import { useEffect, useState } from 'react';
import { fetchSystemMetrics } from '../api';
import type { SystemMetrics } from '../types';
import { CpuIcon, MemoryIcon } from '../icons';

const POLL_MS = 3000;

export function SystemHealthPanel() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let interval: ReturnType<typeof setInterval>;

    async function load() {
      try {
        setMetrics(await fetchSystemMetrics(controller.signal));
      } catch {
        // Transient poll failure - next tick retries; the panel just keeps its last known value.
      }
    }

    load();
    interval = setInterval(load, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const memoryPercent =
    metrics?.memoryUsedMb && metrics.memoryTotalMb ? Math.round((100 * metrics.memoryUsedMb) / metrics.memoryTotalMb) : null;

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">System Health</span>
      </div>
      {!metrics || !metrics.supported ? (
        <p className="loading">Host CPU/RAM metrics aren't available on this platform.</p>
      ) : (
        <div className="health-rows">
          <div className="health-row">
            <span className="health-icon">
              <CpuIcon />
            </span>
            <div className="health-info">
              <div className="health-label">CPU Usage</div>
              <div className="health-value">{metrics.cpuPercent === null ? '—' : `${Math.round(metrics.cpuPercent)}%`}</div>
              <div className="health-bar">
                <div className="health-bar-fill" style={{ width: `${metrics.cpuPercent ?? 0}%` }} />
              </div>
            </div>
          </div>
          <div className="health-row">
            <span className="health-icon">
              <MemoryIcon />
            </span>
            <div className="health-info">
              <div className="health-label">Memory</div>
              <div className="health-value">
                {metrics.memoryUsedMb && metrics.memoryTotalMb
                  ? `${(metrics.memoryUsedMb / 1024).toFixed(1)} / ${(metrics.memoryTotalMb / 1024).toFixed(1)} GB`
                  : '—'}
              </div>
              <div className="health-bar">
                <div className="health-bar-fill health-bar-fill-alt" style={{ width: `${memoryPercent ?? 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
