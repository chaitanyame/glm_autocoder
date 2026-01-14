import { Wifi, WifiOff, Copy, Check, FolderOpen, ChevronDown, Cpu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getProjectSettings, updateProjectSettings } from '../lib/api'
import type { ProjectSettings, ModelOption } from '../lib/types'

interface ProgressDashboardProps {
  passing: number
  total: number
  percentage: number
  isConnected: boolean
  hostPath?: string | null  // Host path for VS Code
  projectName?: string  // Current project name for model settings
}

export function ProgressDashboard({
  passing,
  total,
  percentage,
  isConnected,
  hostPath,
  projectName,
}: ProgressDashboardProps) {
  const [copied, setCopied] = useState(false)
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [isSavingModel, setIsSavingModel] = useState(false)

  // Load project settings when project changes
  useEffect(() => {
    if (!projectName) {
      setProjectSettings(null)
      return
    }

    const loadSettings = async () => {
      setIsLoadingSettings(true)
      try {
        const settings = await getProjectSettings(projectName)
        setProjectSettings(settings)
      } catch (err) {
        console.error('Failed to load project settings:', err)
      } finally {
        setIsLoadingSettings(false)
      }
    }

    loadSettings()
  }, [projectName])

  const handleModelChange = async (modelId: string) => {
    if (!projectName || !projectSettings) return
    
    setIsSavingModel(true)
    try {
      const updated = await updateProjectSettings(projectName, { selected_model: modelId })
      setProjectSettings(updated)
    } catch (err) {
      console.error('Failed to update model:', err)
    } finally {
      setIsSavingModel(false)
    }
  }

  const handleCopyPath = async () => {
    if (!hostPath) return
    try {
      await navigator.clipboard.writeText(hostPath)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy path:', err)
    }
  }

  return (
    <div className="neo-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold uppercase">
          Progress
        </h2>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi size={16} className="text-[var(--color-status-done)]" />
              <span className="text-sm text-[var(--color-status-done)]">Live</span>
            </>
          ) : (
            <>
              <WifiOff size={16} className="text-[var(--color-status-error)]" />
              <span className="text-sm text-[var(--color-status-error)]">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Host Path Display */}
      {hostPath && (
        <div className="mb-4 p-3 bg-[var(--color-bg-tertiary)] border-2 border-[var(--color-border-default)] rounded">
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen size={14} className="text-[var(--color-text-secondary)]" />
            <span className="text-xs font-medium text-[var(--color-neo-text-secondary)] uppercase">
              Project Path (VS Code)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-[var(--color-neo-text)] break-all">
              {hostPath}
            </code>
            <button
              onClick={handleCopyPath}
              className="neo-button-sm p-1.5 flex-shrink-0"
              title="Copy path"
            >
              {copied ? (
                <Check size={14} className="text-[var(--color-neo-done)]" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Model Selector */}
      {projectName && projectSettings && (
        <div className="mb-4 p-3 bg-[var(--color-neo-cream)] border-2 border-[var(--color-neo-border)] rounded">
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={14} className="text-[var(--color-neo-text-secondary)]" />
            <span className="text-xs font-medium text-[var(--color-neo-text-secondary)] uppercase">
              AI Model
            </span>
          </div>
          <div className="relative">
            <select
              value={projectSettings.selected_model}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isSavingModel || isLoadingSettings}
              className="w-full px-3 py-2 pr-8 border-2 border-[var(--color-neo-border)] bg-white font-display text-sm font-medium appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {projectSettings.available_models.map((model: ModelOption) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <ChevronDown 
              size={16} 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-neo-text-secondary)] pointer-events-none" 
            />
          </div>
          <p className="mt-1 text-xs text-[var(--color-neo-text-secondary)]">
            {projectSettings.available_models.find(m => m.id === projectSettings.selected_model)?.description}
          </p>
        </div>
      )}

      {/* Large Percentage */}
      <div className="text-center mb-6">
        <span className="font-display text-6xl font-bold">
          {percentage.toFixed(1)}
        </span>
        <span className="font-display text-3xl font-bold text-[var(--color-text-secondary)]">
          %
        </span>
      </div>

      {/* Progress Bar */}
      <div className="neo-progress mb-4">
        <div
          className="neo-progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-8 text-center">
        <div>
          <span className="font-mono text-3xl font-bold text-[var(--color-status-done)]">
            {passing}
          </span>
          <span className="block text-sm text-[var(--color-text-secondary)] uppercase">
            Passing
          </span>
        </div>
        <div className="text-4xl text-[var(--color-text-secondary)]">/</div>
        <div>
          <span className="font-mono text-3xl font-bold">
            {total}
          </span>
          <span className="block text-sm text-[var(--color-text-secondary)] uppercase">
            Total
          </span>
        </div>
      </div>
    </div>
  )
}
