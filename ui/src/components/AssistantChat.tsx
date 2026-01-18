/**
 * Assistant Chat Component
 *
 * Main chat interface for the project assistant.
 * Displays messages and handles user input.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAssistantChat } from '../hooks/useAssistantChat'
import { getSetupStatus } from '../lib/api'
import type { SetupStatus } from '../lib/types'
import { ChatMessage } from './ChatMessage'

interface AssistantChatProps {
  projectName: string
}

export function AssistantChat({ projectName }: AssistantChatProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasStartedRef = useRef(false)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  // Memoize the error handler to prevent infinite re-renders
  const handleError = useCallback((error: string) => {
    console.error('Assistant error:', error)
  }, [])

  const {
    messages,
    isLoading,
    connectionStatus,
    start,
    sendMessage,
  } = useAssistantChat({
    projectName,
    onError: handleError,
  })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadSetupStatus = useCallback(async () => {
    setSetupError(null)
    try {
      const status = await getSetupStatus()
      setSetupStatus(status)
      return status
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Failed to load setup status')
      return null
    }
  }, [])

  // Load setup status on mount
  useEffect(() => {
    loadSetupStatus()
  }, [loadSetupStatus])

  // Start the chat session when setup is ready (only once)
  // With API key configured (GLM mode), we don't need Claude CLI credentials
  useEffect(() => {
    if (hasStartedRef.current) return
    if (!setupStatus) return

    // Need API key OR credentials, plus Claude CLI
    const hasAuth = setupStatus.api_key_configured || setupStatus.credentials
    if (!hasAuth) return
    if (!setupStatus.claude_cli) return

    hasStartedRef.current = true
    start()
  }, [setupStatus, start])

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus()
    }
  }, [isLoading])

  const handleSend = () => {
    const content = inputValue.trim()
    if (!content || isLoading) return

    sendMessage(content)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Setup status banner - only show if there's an actual problem */}
      {/* With API key configured (GLM mode), we don't need Claude CLI credentials */}
      {(setupError || (setupStatus && (!setupStatus.api_key_configured || !setupStatus.claude_cli))) && (
        <div className="px-4 py-3 border-b-2 border-[var(--color-neo-border)] bg-[var(--color-neo-bg)]">
          <div className="flex items-start gap-2 text-sm text-[var(--color-neo-text-secondary)]">
            <AlertTriangle size={16} className="mt-0.5 text-[var(--color-neo-danger)]" />
            <div className="flex-1">
              {setupError ? (
                <div>Setup check failed: {setupError}</div>
              ) : (
                <>
                  {!setupStatus?.api_key_configured && (
                    <div>API key not configured. Open Settings to add your Z.AI API key.</div>
                  )}
                  {setupStatus?.api_key_configured && !setupStatus?.claude_cli && (
                    <div>Claude CLI not found. Install it and ensure it is on PATH.</div>
                  )}
                </>
              )}
            </div>
            <button
              onClick={loadSetupStatus}
              className="neo-btn neo-btn-ghost p-1.5"
              title="Refresh setup status"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Connection status indicator */}
      <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-[var(--color-neo-border)] bg-[var(--color-neo-bg)]">
        {connectionStatus === 'connected' ? (
          <>
            <Wifi size={14} className="text-[var(--color-neo-done)]" />
            <span className="text-xs text-[var(--color-neo-text-secondary)]">Connected</span>
          </>
        ) : connectionStatus === 'connecting' ? (
          <>
            <Loader2 size={14} className="text-[var(--color-neo-progress)] animate-spin" />
            <span className="text-xs text-[var(--color-neo-text-secondary)]">Connecting...</span>
          </>
        ) : (
          <>
            <WifiOff size={14} className="text-[var(--color-neo-danger)]" />
            <span className="text-xs text-[var(--color-neo-text-secondary)]">Disconnected</span>
          </>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-[var(--color-neo-bg)]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-neo-text-secondary)] text-sm">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Connecting to assistant...</span>
              </div>
            ) : (
              <span>Ask me anything about the codebase</span>
            )}
          </div>
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && messages.length > 0 && (
        <div className="px-4 py-2 border-t-2 border-[var(--color-neo-border)] bg-[var(--color-neo-bg)]">
          <div className="flex items-center gap-2 text-[var(--color-neo-text-secondary)] text-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-[var(--color-neo-progress)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-[var(--color-neo-progress)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-[var(--color-neo-progress)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>Thinking...</span>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t-3 border-[var(--color-neo-border)] p-4 bg-white">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the codebase..."
            disabled={isLoading || connectionStatus !== 'connected'}
            className="
              flex-1
              neo-input
              resize-none
              min-h-[44px]
              max-h-[120px]
              py-2.5
            "
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || connectionStatus !== 'connected'}
            className="
              neo-btn neo-btn-primary
              px-4
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            title="Send message"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="text-xs text-[var(--color-neo-text-secondary)] mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
