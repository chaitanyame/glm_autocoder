import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Loader2, Settings as SettingsIcon, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react'
import { getSettings, updateSettings } from '../lib/api'
import type { Settings } from '../lib/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSettings()
      setSettings(data)
      setApiKey('') // Don't pre-fill API key for security
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      if (!apiKey.trim()) {
        setError('Please enter an API key')
        setIsSaving(false)
        return
      }

      const updated = await updateSettings({ api_key: apiKey.trim() })
      setSettings(updated)
      setApiKey('')
      setSuccess('API key saved successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative neo-card w-full max-w-lg mx-4 p-6 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <SettingsIcon size={24} />
            <h2 className="font-display text-2xl font-bold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-neo-bg-alt)] rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-[var(--color-neo-accent)]" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* API Connection Status */}
            <div className={`p-4 border-3 rounded ${
              settings?.api_key_configured 
                ? 'border-[var(--color-neo-done)] bg-[var(--color-neo-done)]/10' 
                : 'border-[var(--color-neo-danger)] bg-[var(--color-neo-danger)]/10'
            }`}>
              <div className="flex items-center gap-3">
                {settings?.api_key_configured ? (
                  <>
                    <Wifi size={24} className="text-[var(--color-neo-done)]" />
                    <div>
                      <div className="font-display font-bold text-[var(--color-neo-done)]">
                        API Connected
                      </div>
                      <div className="text-sm text-[var(--color-neo-text-secondary)]">
                        Key: <code className="font-mono">{settings.api_key_masked}</code>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <WifiOff size={24} className="text-[var(--color-neo-danger)]" />
                    <div>
                      <div className="font-display font-bold text-[var(--color-neo-danger)]">
                        API Not Connected
                      </div>
                      <div className="text-sm text-[var(--color-neo-text-secondary)]">
                        Enter your Z.AI API key below to connect
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* API Key Section */}
            <div>
              <label className="block font-display font-bold mb-2">
                {settings?.api_key_configured ? 'Update API Key' : 'Z.AI API Key'}
              </label>
              <p className="text-sm text-[var(--color-neo-text-secondary)] mb-3">
                {settings?.api_key_configured 
                  ? 'Enter a new key to replace the existing one.' 
                  : 'Required for GLM model support.'}{' '}
                <a
                  href="https://api.z.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-neo-accent)] hover:underline"
                >
                  Get your key →
                </a>
              </p>

              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settings?.api_key_configured ? 'Enter new key to update...' : 'Enter your API key...'}
                  className="w-full px-4 py-3 pr-12 border-3 border-[var(--color-neo-border)] bg-white font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-neo-text-secondary)] hover:text-[var(--color-neo-text)]"
                >
                  {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Model Selection Note */}
            <div className="p-3 bg-[var(--color-neo-bg-alt)] border-2 border-[var(--color-neo-border)] rounded">
              <p className="text-sm text-[var(--color-neo-text-secondary)]">
                <strong>Note:</strong> Model selection is now per-project. Select a model from the project dashboard when running the agent.
              </p>
            </div>

            {/* Base URL (read-only) */}
            <div>
              <label className="block font-display font-bold mb-2">
                API Base URL
              </label>
              <div className="px-4 py-3 border-3 border-[var(--color-neo-border)] bg-[var(--color-neo-bg-alt)] font-mono text-sm text-[var(--color-neo-text-secondary)]">
                {settings?.base_url}
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-[var(--color-neo-danger)]/20 border-2 border-[var(--color-neo-danger)] text-[var(--color-neo-danger)]">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-[var(--color-neo-done)]/20 border-2 border-[var(--color-neo-done)] text-[var(--color-neo-done)]">
                <Check size={16} />
                <span className="text-sm">{success}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t-3 border-[var(--color-neo-border)]">
              <button
                onClick={onClose}
                className="neo-btn neo-btn-secondary px-6 py-2"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !apiKey.trim()}
                className="neo-btn neo-btn-primary px-6 py-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  'Save API Key'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
