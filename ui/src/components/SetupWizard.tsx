import { useEffect, useCallback, useState } from 'react'
import { CheckCircle2, XCircle, Loader2, ExternalLink, Eye, EyeOff, Key } from 'lucide-react'
import { useSetupStatus, useHealthCheck } from '../hooks/useProjects'
import { saveApiKey, getApiKeyStatus } from '../lib/api'
import type { ApiKeyResponse } from '../lib/types'

interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { data: setupStatus, isLoading: setupLoading, error: setupError, refetch: refetchSetup } = useSetupStatus()
  const { data: health, error: healthError } = useHealthCheck()

  // API key state
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyResponse | null>(null)
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isApiHealthy = health?.status === 'healthy' && !healthError
  const isApiKeyConfigured = setupStatus?.api_key_configured ?? false
  const isReady = isApiHealthy && setupStatus?.claude_cli && setupStatus?.credentials && isApiKeyConfigured

  // Fetch API key status on mount
  useEffect(() => {
    if (isApiHealthy) {
      getApiKeyStatus().then(setApiKeyStatus).catch(() => {})
    }
  }, [isApiHealthy])

  // Memoize the completion check to avoid infinite loops
  const checkAndComplete = useCallback(() => {
    if (isReady) {
      onComplete()
    }
  }, [isReady, onComplete])

  // Auto-complete if everything is ready
  useEffect(() => {
    checkAndComplete()
  }, [checkAndComplete])

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return

    setIsSavingKey(true)
    setSaveError(null)

    try {
      const response = await saveApiKey(apiKeyInput.trim())
      if (response.success) {
        setApiKeyStatus(response)
        setApiKeyInput('')
        // Refetch setup status to update api_key_configured
        await refetchSetup()
      } else {
        setSaveError(response.message || 'Failed to save API key')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setIsSavingKey(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-neo-bg)] flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-lg p-8">
        <h1 className="font-display text-3xl font-bold text-center mb-2">
          Setup Wizard
        </h1>
        <p className="text-center text-[var(--color-neo-text-secondary)] mb-8">
          Let's make sure everything is ready to go
        </p>

        <div className="space-y-4">
          {/* API Health */}
          <SetupItem
            label="Backend Server"
            description="FastAPI server is running"
            status={healthError ? 'error' : isApiHealthy ? 'success' : 'loading'}
          />

          {/* Claude CLI */}
          <SetupItem
            label="Claude CLI"
            description="Claude Code CLI is installed"
            status={
              setupLoading
                ? 'loading'
                : setupError
                ? 'error'
                : setupStatus?.claude_cli
                ? 'success'
                : 'error'
            }
            helpLink="https://docs.anthropic.com/claude/claude-code"
            helpText="Install Claude Code"
          />

          {/* Credentials */}
          <SetupItem
            label="Anthropic Credentials"
            description="API credentials are configured"
            status={
              setupLoading
                ? 'loading'
                : setupError
                ? 'error'
                : setupStatus?.credentials
                ? 'success'
                : 'error'
            }
            helpLink="https://console.anthropic.com/account/keys"
            helpText="Get API Key"
          />

          {/* API Key Configuration */}
          <div className="p-4 bg-[var(--color-neo-bg)] border-3 border-[var(--color-neo-border)]">
            <div className="flex items-start gap-4">
              {/* Status Icon */}
              <div className="flex-shrink-0 mt-1">
                {setupLoading ? (
                  <Loader2 size={24} className="animate-spin text-[var(--color-neo-progress)]" />
                ) : isApiKeyConfigured ? (
                  <CheckCircle2 size={24} className="text-[var(--color-neo-done)]" />
                ) : (
                  <Key size={24} className="text-[var(--color-neo-pending)]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold">Z.AI API Key</span>
                </div>
                <p className="text-sm text-[var(--color-neo-text-secondary)]">
                  {isApiKeyConfigured && apiKeyStatus?.masked_key
                    ? `Configured: ${apiKeyStatus.masked_key}`
                    : 'Required for GLM model support'}
                </p>

                {/* API Key Input */}
                {!isApiKeyConfigured && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="Enter your Z.AI API key"
                          className="w-full px-3 py-2 pr-10 border-3 border-[var(--color-neo-border)] bg-white font-mono text-sm"
                          disabled={isSavingKey}
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-neo-text-secondary)] hover:text-[var(--color-neo-text)]"
                        >
                          {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <button
                        onClick={handleSaveApiKey}
                        disabled={!apiKeyInput.trim() || isSavingKey}
                        className="neo-btn neo-btn-primary px-4 py-2 disabled:opacity-50"
                      >
                        {isSavingKey ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          'Save'
                        )}
                      </button>
                    </div>
                    {saveError && (
                      <p className="text-sm text-[var(--color-neo-danger)]">{saveError}</p>
                    )}
                    <a
                      href="https://api.z.ai/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[var(--color-neo-accent)] hover:underline"
                    >
                      Get your API key <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Reconfigure option when already configured */}
                {isApiKeyConfigured && (
                  <button
                    onClick={() => {
                      setApiKeyStatus(null)
                      refetchSetup()
                    }}
                    className="mt-2 text-sm text-[var(--color-neo-accent)] hover:underline"
                  >
                    Reconfigure API key
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Node.js */}
          <SetupItem
            label="Node.js"
            description="Node.js is installed (for UI dev)"
            status={
              setupLoading
                ? 'loading'
                : setupError
                ? 'error'
                : setupStatus?.node
                ? 'success'
                : 'warning'
            }
            helpLink="https://nodejs.org"
            helpText="Install Node.js"
            optional
          />
        </div>

        {/* Continue Button */}
        {isReady && (
          <button
            onClick={onComplete}
            className="neo-btn neo-btn-success w-full mt-8"
          >
            Continue to Dashboard
          </button>
        )}

        {/* Error Message */}
        {(healthError || setupError) && (
          <div className="mt-6 p-4 bg-[var(--color-neo-danger)] text-white border-3 border-[var(--color-neo-border)]">
            <p className="font-bold mb-2">Setup Error</p>
            <p className="text-sm">
              {healthError
                ? 'Cannot connect to the backend server. Make sure to run start_ui.py first.'
                : 'Failed to check setup status.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface SetupItemProps {
  label: string
  description: string
  status: 'success' | 'error' | 'warning' | 'loading'
  helpLink?: string
  helpText?: string
  optional?: boolean
}

function SetupItem({
  label,
  description,
  status,
  helpLink,
  helpText,
  optional,
}: SetupItemProps) {
  return (
    <div className="flex items-start gap-4 p-4 bg-[var(--color-neo-bg)] border-3 border-[var(--color-neo-border)]">
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-1">
        {status === 'success' ? (
          <CheckCircle2 size={24} className="text-[var(--color-neo-done)]" />
        ) : status === 'error' ? (
          <XCircle size={24} className="text-[var(--color-neo-danger)]" />
        ) : status === 'warning' ? (
          <XCircle size={24} className="text-[var(--color-neo-pending)]" />
        ) : (
          <Loader2 size={24} className="animate-spin text-[var(--color-neo-progress)]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold">{label}</span>
          {optional && (
            <span className="text-xs text-[var(--color-neo-text-secondary)]">
              (optional)
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--color-neo-text-secondary)]">
          {description}
        </p>
        {(status === 'error' || status === 'warning') && helpLink && (
          <a
            href={helpLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-sm text-[var(--color-neo-accent)] hover:underline"
          >
            {helpText} <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}
