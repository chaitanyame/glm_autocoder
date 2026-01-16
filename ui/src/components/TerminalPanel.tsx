/**
 * Terminal Panel Component
 * 
 * Integrated terminal using xterm.js for running commands.
 * Connects via WebSocket to the backend terminal endpoint.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { RotateCcw, Circle, AlertCircle } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  projectName: string
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export function TerminalPanel({ projectName }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const commandBufferRef = useRef<string>('')

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return

    // Check if dark mode
    const isDark = document.documentElement.classList.contains('dark')

    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: 'var(--font-neo-mono), "JetBrains Mono", monospace',
      fontSize: 13,
      theme: isDark ? {
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
      },
      rows: 24,
      cols: 80,
      scrollback: 1000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(terminalRef.current)

    // Fit to container
    try {
      fitAddon.fit()
    } catch (e) {
      // Ignore fit errors on initial load
    }

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Handle window resize
    const handleResize = () => {
      try {
        fitAddon.fit()
      } catch (e) {
        // Ignore resize errors
      }
    }
    window.addEventListener('resize', handleResize)

    // Handle user input
    xterm.onData((data) => {
      // Send to WebSocket if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Handle Enter key
        if (data === '\r') {
          const command = commandBufferRef.current
          commandBufferRef.current = ''
          xterm.write('\r\n')
          wsRef.current.send(JSON.stringify({ type: 'command', command }))
        } 
        // Handle Backspace
        else if (data === '\x7f') {
          if (commandBufferRef.current.length > 0) {
            commandBufferRef.current = commandBufferRef.current.slice(0, -1)
            xterm.write('\b \b')
          }
        }
        // Handle Ctrl+C
        else if (data === '\x03') {
          wsRef.current.send(JSON.stringify({ type: 'signal', signal: 'SIGINT' }))
          commandBufferRef.current = ''
          xterm.write('^C\r\n$ ')
        }
        // Regular character
        else {
          commandBufferRef.current += data
          xterm.write(data)
        }
      }
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      xterm.dispose()
    }
  }, [])

  // Connect WebSocket
  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    setStatus('connecting')
    setErrorMessage(null)

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal/${encodeURIComponent(projectName)}`
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      if (xtermRef.current) {
        xtermRef.current.clear()
        xtermRef.current.write('\x1b[32m✓ Connected to terminal\x1b[0m\r\n\r\n$ ')
      }
      // Fit terminal after connection
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit()
        } catch (e) {
          // Ignore
        }
      }, 100)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (xtermRef.current) {
          switch (message.type) {
            case 'output':
              xtermRef.current.write(message.content)
              break
            case 'error':
              xtermRef.current.write(`\x1b[31m${message.content}\x1b[0m`)
              break
            case 'exit':
              xtermRef.current.write(`\r\n\x1b[90m[Process exited with code ${message.exitCode}]\x1b[0m\r\n$ `)
              break
            case 'pong':
              // Keep-alive response, ignore
              break
          }
        }
      } catch (err) {
        // Plain text output
        if (xtermRef.current) {
          xtermRef.current.write(event.data)
        }
      }
    }

    ws.onerror = () => {
      setStatus('error')
      setErrorMessage('Failed to connect to terminal')
    }

    ws.onclose = () => {
      setStatus('disconnected')
      if (xtermRef.current) {
        xtermRef.current.write('\r\n\x1b[33m⚠ Disconnected from terminal\x1b[0m\r\n')
      }
    }
  }, [projectName])

  // Auto-connect on mount
  useEffect(() => {
    const timer = setTimeout(connect, 100)
    return () => {
      clearTimeout(timer)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  // Keep-alive ping
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'var(--color-status-done)'
      case 'connecting': return 'var(--color-status-pending)'
      case 'error': return 'var(--color-status-error)'
      default: return 'var(--color-text-tertiary)'
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-primary)]">
      {/* Status bar */}
      <div className="
        flex items-center justify-between px-3 py-1.5
        border-b border-[var(--color-border-subtle)]
        bg-[var(--color-bg-tertiary)]
      ">
        <div className="flex items-center gap-2">
          <Circle 
            size={8} 
            fill={getStatusColor()} 
            color={getStatusColor()} 
          />
          <span className="text-xs text-[var(--color-text-secondary)] capitalize">
            {status}
          </span>
          {errorMessage && (
            <span className="text-xs text-[var(--color-status-error)] flex items-center gap-1">
              <AlertCircle size={12} />
              {errorMessage}
            </span>
          )}
        </div>
        <button
          onClick={connect}
          disabled={status === 'connecting'}
          className="
            neo-btn neo-btn-ghost p-1.5
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          title="Reconnect"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Terminal container */}
      <div 
        ref={terminalRef} 
        className="flex-1 p-2 overflow-hidden"
        style={{ 
          minHeight: 0,
        }}
      />

      {/* Help text */}
      <div className="
        px-3 py-1.5
        border-t border-[var(--color-border-subtle)]
        bg-[var(--color-bg-tertiary)]
        text-[10px] text-[var(--color-text-tertiary)]
        font-mono
      ">
        Commands are validated for security. Ctrl+C to interrupt.
      </div>
    </div>
  )
}
