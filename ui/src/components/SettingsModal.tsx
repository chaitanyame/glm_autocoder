import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Loader2, Settings as SettingsIcon, Check, AlertCircle } from 'lucide-react'
import { getSettings, updateSettings } from '../lib/api'
import type { Settings, ModelOption } from '../lib/types'

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
  const [selectedModel, setSelectedModel] = useState('')

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
      setSelectedModel(data.selected_model)
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
      const updates: { api_key?: string; selected_model?: string } = {}
      
      if (apiKey.trim()) {
        updates.api_key = apiKey.trim()
      }
      
      if (selectedModel && selectedModel !== settings?.selected_model) {
        updates.selected_model = selectedModel
      }

      if (Object.keys(updates).length === 0) {
        setError('No changes to save')
        setIsSaving(false)
        return
      }

      const updated = await updateSettings(updates)
      setSettings(updated)
      setApiKey('')
      setSuccess('Settings saved successfully!')
      
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
            {/* API Key Section */}
            <div>
              <label className="block font-display font-bold mb-2">
                Z.AI API Key
              </label>
              <p className="text-sm text-[var(--color-neo-text-secondary)] mb-3">
                Required for GLM model support.{' '}
                <a
                  href="https://api.z.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-neo-accent)] hover:underline"
                >
                  Get your key →
                </a>
              </p>
              
              {settings?.api_key_configured && (
                <div className="mb-3 p-3 bg-[var(--color-neo-done)]/20 border-2 border-[var(--color-neo-done)] rounded">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-[var(--color-neo-done)]" />
                    <span className="text-sm">
                      Current key: <code className="font-mono">{settings.api_key_masked}</code>
                    </span>
                  </div>
                </div>
              )}

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

            {/* Model Selection */}
            <div>
              <label className="block font-display font-bold mb-2">
                Model
              </label>
              <p className="text-sm text-[var(--color-neo-text-secondary)] mb-3">
                Select the AI model for code generation.
              </p>
              
              <div className="space-y-2">
                {settings?.available_models.map((model: ModelOption) => (
                  <label
                    key={model.id}
                    className={`flex items-start gap-3 p-3 border-3 cursor-pointer transition-colors ${
                      selectedModel === model.id
                        ? 'border-[var(--color-neo-accent)] bg-[var(--color-neo-accent)]/10'
                        : 'border-[var(--color-neo-border)] hover:border-[var(--color-neo-accent)]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={model.id}
                      checked={selectedModel === model.id}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-display font-bold">{model.name}</div>
                      <div className="text-sm text-[var(--color-neo-text-secondary)]">
                        {model.description}
                      </div>
                      <code className="text-xs text-[var(--color-neo-text-secondary)] font-mono">
                        {model.id}
                      </code>
                    </div>
                  </label>
                ))}
              </div>
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
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || (!apiKey.trim() && selectedModel === settings?.selected_model)}
                className="neo-btn neo-btn-primary px-6 py-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
