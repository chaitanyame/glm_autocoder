/**
 * Terminal Panel Component
 * 
 * Multi-terminal panel using xterm.js for running commands.
 * Supports up to 4 terminal sessions with tabbed interface.
 * Each terminal connects via WebSocket to the backend terminal endpoint.
 * 
 * Terminal sessions are preserved when switching tabs by hiding/showing
 * the terminal elements rather than destroying them.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Plus, X, RotateCcw, Circle, AlertCircle, Terminal } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  projectName: string
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface TerminalSession {
  id: string
  name: string
  status: ConnectionStatus
  errorMessage: string | null
}

interface TerminalInstance {
  xterm: XTerm
  fitAddon: FitAddon
  ws: WebSocket | null
  commandBuffer: string
  inputHandler: { dispose: () => void } | null
  containerDiv: HTMLDivElement
}

const MAX_TERMINALS = 4

// Store terminal instances outside React state to avoid stale closures
const terminalInstances = new Map<string, TerminalInstance>()

export function TerminalPanel({ projectName }: TerminalPanelProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const sessionCounterRef = useRef(0)

  // Get xterm theme based on current mode
  const getTheme = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? {
      background: '#1c1c24',
      foreground: '#e8e8ed',
      cursor: '#e8e8ed',
      cursorAccent: '#1c1c24',
      selectionBackground: '#404050',
      black: '#1c1c24',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#f472b6',
      cyan: '#38bdf8',
      white: '#e8e8ed',
      brightBlack: '#6b7280',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fcd34d',
      brightBlue: '#93c5fd',
      brightMagenta: '#f9a8d4',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff',
    } : {
      background: '#fffef5',
      foreground: '#1a1a1a',
      cursor: '#1a1a1a',
      cursorAccent: '#fffef5',
      selectionBackground: '#e0e0d8',
      black: '#1a1a1a',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#ca8a04',
      blue: '#2563eb',
      magenta: '#db2777',
      cyan: '#0891b2',
      white: '#f5f5f5',
      brightBlack: '#6b7280',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#eab308',
      brightBlue: '#3b82f6',
      brightMagenta: '#ec4899',
      brightCyan: '#06b6d4',
      brightWhite: '#ffffff',
    }
  }, [])

  // Update session status
  const updateSessionStatus = useCallback((sessionId: string, status: ConnectionStatus, errorMessage: string | null = null) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, status, errorMessage } : s
    ))
  }, [])

  // Connect a terminal session to WebSocket
  const connectSession = useCallback((sessionId: string) => {
    const instance = terminalInstances.get(sessionId)
    if (!instance) {
      console.error('[Terminal] No instance for session:', sessionId)
      return
    }

    const { xterm } = instance

    // Close existing connection
    if (instance.ws) {
      instance.ws.close()
      instance.ws = null
    }

    updateSessionStatus(sessionId, 'connecting')
    instance.commandBuffer = ''

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal/${encodeURIComponent(projectName)}`
    
    console.log(`[Terminal ${sessionId}] Connecting to:`, wsUrl)
    const ws = new WebSocket(wsUrl)
    instance.ws = ws

    ws.onopen = () => {
      console.log(`[Terminal ${sessionId}] WebSocket connected`)
      updateSessionStatus(sessionId, 'connected')
      xterm.clear()
      xterm.write('\x1b[32m✓ Connected to terminal\x1b[0m\r\n\r\n$ ')
      xterm.focus()
      
      setTimeout(() => {
        try {
          instance.fitAddon.fit()
        } catch (e) {
          // Ignore
        }
      }, 100)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        switch (message.type) {
          case 'output':
            xterm.write(message.content)
            break
          case 'error':
            xterm.write(`\x1b[31m${message.content}\x1b[0m`)
            break
          case 'exit':
            xterm.write(`\r\n\x1b[90m[Process exited with code ${message.exitCode}]\x1b[0m\r\n$ `)
            break
          case 'connected':
            console.log(`[Terminal ${sessionId}] Backend confirmed connection`)
            break
          case 'pong':
            // Keep-alive response
            break
        }
      } catch (err) {
        // Plain text output
        xterm.write(event.data)
      }
    }

    ws.onerror = (err) => {
      console.error(`[Terminal ${sessionId}] WebSocket error:`, err)
      updateSessionStatus(sessionId, 'error', 'Connection failed')
    }

    ws.onclose = () => {
      console.log(`[Terminal ${sessionId}] WebSocket closed`)
      updateSessionStatus(sessionId, 'disconnected')
      instance.ws = null
      xterm.write('\r\n\x1b[33m⚠ Disconnected from terminal\x1b[0m\r\n')
    }
  }, [projectName, updateSessionStatus])

  // Create and initialize a new terminal session
  const createSession = useCallback(() => {
    if (sessions.length >= MAX_TERMINALS) {
      console.warn('[Terminal] Maximum terminals reached')
      return null
    }

    if (!terminalContainerRef.current) {
      console.error('[Terminal] Container not ready')
      return null
    }

    sessionCounterRef.current += 1
    const sessionId = `term-${Date.now()}-${sessionCounterRef.current}`
    const sessionNum = sessions.length + 1

    // Create container div for this terminal
    const containerDiv = document.createElement('div')
    containerDiv.id = `terminal-${sessionId}`
    containerDiv.className = 'absolute inset-0'
    containerDiv.style.display = 'block'
    terminalContainerRef.current.appendChild(containerDiv)

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: 'var(--font-neo-mono), "JetBrains Mono", monospace',
      fontSize: 13,
      theme: getTheme(),
      rows: 24,
      cols: 80,
      scrollback: 1000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(containerDiv)
    
    try {
      fitAddon.fit()
    } catch (e) {
      // Ignore fit errors
    }

    // Store instance
    const instance: TerminalInstance = {
      xterm,
      fitAddon,
      ws: null,
      commandBuffer: '',
      inputHandler: null,
      containerDiv,
    }
    terminalInstances.set(sessionId, instance)

    // Handle user input
    instance.inputHandler = xterm.onData((data) => {
      const currentInstance = terminalInstances.get(sessionId)
      if (!currentInstance) return

      const ws = currentInstance.ws
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log(`[Terminal ${sessionId}] WebSocket not open, ignoring input`)
        return
      }

      // Handle Enter key
      if (data === '\r') {
        const command = currentInstance.commandBuffer
        currentInstance.commandBuffer = ''
        xterm.write('\r\n')
        ws.send(JSON.stringify({ type: 'command', command }))
      } 
      // Handle Backspace
      else if (data === '\x7f') {
        if (currentInstance.commandBuffer.length > 0) {
          currentInstance.commandBuffer = currentInstance.commandBuffer.slice(0, -1)
          xterm.write('\b \b')
        }
      }
      // Handle Ctrl+C
      else if (data === '\x03') {
        ws.send(JSON.stringify({ type: 'signal', signal: 'SIGINT' }))
        currentInstance.commandBuffer = ''
        xterm.write('^C\r\n$ ')
      }
      // Regular character
      else {
        currentInstance.commandBuffer += data
        xterm.write(data)
      }
    })

    const newSession: TerminalSession = {
      id: sessionId,
      name: `Terminal ${sessionNum}`,
      status: 'disconnected',
      errorMessage: null,
    }

    setSessions(prev => [...prev, newSession])
    setActiveSessionId(sessionId)

    // Hide all other terminals
    terminalInstances.forEach((inst, id) => {
      if (id !== sessionId) {
        inst.containerDiv.style.display = 'none'
      }
    })

    // Connect after initialization
    setTimeout(() => {
      connectSession(sessionId)
    }, 100)

    return sessionId
  }, [sessions.length, getTheme, connectSession])

  // Close a terminal session
  const closeSession = useCallback((sessionId: string) => {
    const instance = terminalInstances.get(sessionId)
    if (instance) {
      instance.inputHandler?.dispose()
      instance.ws?.close()
      instance.xterm.dispose()
      instance.containerDiv.remove()
      terminalInstances.delete(sessionId)
    }

    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== sessionId)
      // If closing active session, switch to another
      if (activeSessionId === sessionId && newSessions.length > 0) {
        const newActiveId = newSessions[newSessions.length - 1].id
        setActiveSessionId(newActiveId)
        // Show the new active terminal
        const newActiveInstance = terminalInstances.get(newActiveId)
        if (newActiveInstance) {
          newActiveInstance.containerDiv.style.display = 'block'
          newActiveInstance.xterm.focus()
          try {
            newActiveInstance.fitAddon.fit()
          } catch (e) {
            // Ignore
          }
        }
      } else if (newSessions.length === 0) {
        setActiveSessionId(null)
      }
      return newSessions
    })
  }, [activeSessionId])

  // Switch to a terminal session
  const switchToSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) return

    // Hide all terminals
    terminalInstances.forEach((instance) => {
      instance.containerDiv.style.display = 'none'
    })

    // Show the target terminal
    const targetInstance = terminalInstances.get(sessionId)
    if (targetInstance) {
      targetInstance.containerDiv.style.display = 'block'
      targetInstance.xterm.focus()
      try {
        targetInstance.fitAddon.fit()
      } catch (e) {
        // Ignore
      }
    }

    setActiveSessionId(sessionId)
  }, [activeSessionId])

  // Track if we've initialized
  const initializedRef = useRef(false)

  // Create first terminal on mount - use a small delay to ensure ref is ready
  useEffect(() => {
    if (!initializedRef.current) {
      const timer = setTimeout(() => {
        if (sessions.length === 0 && terminalContainerRef.current) {
          initializedRef.current = true
          createSession()
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [sessions.length, createSession])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (activeSessionId) {
        const instance = terminalInstances.get(activeSessionId)
        if (instance) {
          try {
            instance.fitAddon.fit()
          } catch (e) {
            // Ignore
          }
        }
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeSessionId])

  // Keep-alive ping for all sessions
  useEffect(() => {
    const interval = setInterval(() => {
      terminalInstances.forEach((instance) => {
        if (instance.ws?.readyState === WebSocket.OPEN) {
          instance.ws.send(JSON.stringify({ type: 'ping' }))
        }
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminalInstances.forEach((instance) => {
        instance.inputHandler?.dispose()
        instance.ws?.close()
        instance.xterm.dispose()
        instance.containerDiv.remove()
      })
      terminalInstances.clear()
    }
  }, [])

  const activeSession = sessions.find(s => s.id === activeSessionId)

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected': return 'var(--color-status-done)'
      case 'connecting': return 'var(--color-status-pending)'
      case 'error': return 'var(--color-status-error)'
      default: return 'var(--color-text-tertiary)'
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-primary)]">
      {/* Tab bar */}
      <div className="
        flex items-center gap-1 px-2 py-1.5
        border-b border-[var(--color-border-subtle)]
        bg-[var(--color-bg-tertiary)]
        overflow-x-auto
        flex-shrink-0
      ">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded
              cursor-pointer select-none text-xs font-mono
              transition-colors duration-150
              ${session.id === activeSessionId
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }
            `}
            onClick={() => switchToSession(session.id)}
          >
            <Circle 
              size={6} 
              fill={getStatusColor(session.status)} 
              color={getStatusColor(session.status)} 
            />
            <span>{session.name}</span>
            {sessions.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeSession(session.id)
                }}
                className="
                  p-0.5 rounded hover:bg-[var(--color-bg-tertiary)]
                  text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]
                "
                title="Close terminal"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        
        {sessions.length < MAX_TERMINALS && (
          <button
            onClick={() => createSession()}
            className="
              flex items-center gap-1 px-2 py-1 rounded
              text-xs text-[var(--color-text-secondary)]
              hover:bg-[var(--color-bg-secondary)]
              transition-colors duration-150
            "
            title="New terminal"
          >
            <Plus size={14} />
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status and reconnect for active terminal */}
        {activeSession && (
          <div className="flex items-center gap-2">
            {activeSession.errorMessage && (
              <span className="text-xs text-[var(--color-status-error)] flex items-center gap-1">
                <AlertCircle size={12} />
                {activeSession.errorMessage}
              </span>
            )}
            <button
              onClick={() => activeSessionId && connectSession(activeSessionId)}
              disabled={activeSession.status === 'connecting'}
              className="
                neo-btn neo-btn-ghost p-1
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              title="Reconnect"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Terminal container - always rendered, content shown/hidden */}
      <div 
        ref={terminalContainerRef} 
        className={`flex-1 p-2 overflow-hidden cursor-text relative ${sessions.length === 0 ? 'hidden' : ''}`}
        onClick={() => {
          if (activeSessionId) {
            const instance = terminalInstances.get(activeSessionId)
            instance?.xterm.focus()
          }
        }}
      />
      
      {/* Empty state - shown when no terminals */}
      {sessions.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)]">
          <div className="text-center">
            <Terminal size={48} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No terminals open</p>
            <button
              onClick={() => createSession()}
              className="mt-2 neo-btn neo-btn-primary text-xs px-3 py-1"
            >
              New Terminal
            </button>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="
        px-3 py-1.5
        border-t border-[var(--color-border-subtle)]
        bg-[var(--color-bg-tertiary)]
        text-[10px] text-[var(--color-text-tertiary)]
        font-mono
        flex items-center justify-between
        flex-shrink-0
      ">
        <span>Commands are validated for security. Ctrl+C to interrupt.</span>
        <span>{sessions.length}/{MAX_TERMINALS} terminals</span>
      </div>
    </div>
  )
}
