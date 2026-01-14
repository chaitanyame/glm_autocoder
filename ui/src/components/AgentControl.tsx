import { useState } from 'react'
import { Play, Pause, Square, Loader2, Zap, Clock, XCircle } from 'lucide-react'
import {
  useStartAgent,
  useStopAgent,
  usePauseAgent,
  useResumeAgent,
  useSetupStatus,
  useRateLimitStatus,
  useCancelAutoResume,
  useClearRateLimit,
} from '../hooks/useProjects'
import type { AgentStatus } from '../lib/types'

interface AgentControlProps {
  projectName: string
  status: AgentStatus
  yoloMode?: boolean  // From server status - whether currently running in YOLO mode
  isConnected?: boolean
}

export function AgentControl({ projectName, status, yoloMode = false, isConnected = true }: AgentControlProps) {
  const [yoloEnabled, setYoloEnabled] = useState(false)

  const { data: setupStatus } = useSetupStatus()
  const { data: rateLimitStatus } = useRateLimitStatus(projectName)
  const isApiKeyConfigured = setupStatus?.api_key_configured ?? false

  const canStartOrResume = isConnected && isApiKeyConfigured
  const disabledReason = !isConnected
    ? 'Offline: wait for connection to be Online'
    : !isApiKeyConfigured
      ? 'API key required: set it in Setup (gear icon)'
      : ''

  const startAgent = useStartAgent(projectName)
  const stopAgent = useStopAgent(projectName)
  const pauseAgent = usePauseAgent(projectName)
  const resumeAgent = useResumeAgent(projectName)
  const cancelAutoResume = useCancelAutoResume(projectName)
  const clearRateLimit = useClearRateLimit(projectName)

  const isLoading =
    startAgent.isPending ||
    stopAgent.isPending ||
    pauseAgent.isPending ||
    resumeAgent.isPending ||
    cancelAutoResume.isPending ||
    clearRateLimit.isPending

  const handleStart = () => {
    if (!canStartOrResume) return
    startAgent.mutate({ yoloMode: yoloEnabled })
  }
  const handleStop = () => stopAgent.mutate()
  const handlePause = () => pauseAgent.mutate()
  const handleResume = () => {
    if (!canStartOrResume) return
    resumeAgent.mutate()
  }
  const handleCancelAutoResume = () => cancelAutoResume.mutate()
  const handleClearRateLimit = () => {
    clearRateLimit.mutate()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Status Indicator */}
      <StatusIndicator status={status} />

      {/* YOLO Mode Indicator - shown when running in YOLO mode */}
      {(status === 'running' || status === 'paused') && yoloMode && (
        <div className="flex items-center gap-1 px-2 py-1 bg-[var(--color-neo-pending)] border-3 border-[var(--color-neo-border)]">
          <Zap size={14} className="text-yellow-900" />
          <span className="font-display font-bold text-xs uppercase text-yellow-900">
            YOLO
          </span>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-1">
        {status === 'stopped' || status === 'crashed' ? (
          <>
            {/* YOLO Toggle - only shown when stopped */}
            <button
              onClick={() => setYoloEnabled(!yoloEnabled)}
              className={`neo-btn text-sm py-2 px-3 ${
                yoloEnabled ? 'neo-btn-warning' : 'neo-btn-secondary'
              }`}
              title="YOLO Mode: Skip testing for rapid prototyping"
              disabled={!canStartOrResume || isLoading}
            >
              <Zap size={18} className={yoloEnabled ? 'text-yellow-900' : ''} />
            </button>
            <button
              onClick={handleStart}
              disabled={isLoading || !canStartOrResume}
              className="neo-btn neo-btn-success text-sm py-2 px-3"
              title={!canStartOrResume ? disabledReason : (yoloEnabled ? "Start Agent (YOLO Mode)" : "Start Agent")}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Play size={18} />
              )}
            </button>
          </>
        ) : status === 'running' ? (
          <>
            <button
              onClick={handlePause}
              disabled={isLoading}
              className="neo-btn neo-btn-warning text-sm py-2 px-3"
              title="Pause Agent"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Pause size={18} />
              )}
            </button>
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="neo-btn neo-btn-danger text-sm py-2 px-3"
              title="Stop Agent"
            >
              <Square size={18} />
            </button>
          </>
        ) : status === 'paused' ? (
          <>
            <button
              onClick={handleResume}
              disabled={isLoading || !canStartOrResume}
              className="neo-btn neo-btn-success text-sm py-2 px-3"
              title={!canStartOrResume ? disabledReason : 'Resume Agent'}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Play size={18} />
              )}
            </button>
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="neo-btn neo-btn-danger text-sm py-2 px-3"
              title="Stop Agent"
            >
              <Square size={18} />
            </button>
          </>
        ) : status === 'rate_limited' ? (
          <>
            {/* Rate limit countdown and controls */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-neo-danger)] bg-opacity-20 border-3 border-[var(--color-neo-danger)]">
              <Clock size={16} className="text-[var(--color-neo-danger)]" />
              <span className="font-display font-bold text-xs uppercase text-[var(--color-neo-danger)]">
                {rateLimitStatus?.seconds_until_reset 
                  ? formatCountdown(rateLimitStatus.seconds_until_reset)
                  : 'Rate Limited'}
              </span>
            </div>
            <button
              onClick={handleCancelAutoResume}
              disabled={isLoading}
              className="neo-btn neo-btn-warning text-sm py-2 px-3"
              title="Cancel auto-resume (manual control)"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <XCircle size={18} />
              )}
            </button>
            <button
              onClick={handleClearRateLimit}
              disabled={isLoading || !canStartOrResume}
              className="neo-btn neo-btn-success text-sm py-2 px-3"
              title="Clear rate limit and restart now"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Play size={18} />
              )}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Ready'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}

function StatusIndicator({ status }: { status: AgentStatus }) {
  const statusConfig = {
    stopped: {
      color: 'var(--color-neo-text-secondary)',
      label: 'Stopped',
      pulse: false,
    },
    running: {
      color: 'var(--color-neo-done)',
      label: 'Running',
      pulse: true,
    },
    paused: {
      color: 'var(--color-neo-pending)',
      label: 'Paused',
      pulse: false,
    },
    crashed: {
      color: 'var(--color-neo-danger)',
      label: 'Crashed',
      pulse: true,
    },
    rate_limited: {
      color: 'var(--color-neo-danger)',
      label: 'Rate Limited',
      pulse: true,
    },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)] border-3 border-[var(--color-border-default)]">
      <span
        className={`w-3 h-3 rounded-full ${config.pulse ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: config.color }}
      />
      <span
        className="font-display font-bold text-sm uppercase"
        style={{ color: config.color }}
      >
        {config.label}
      </span>
    </div>
  )
}
