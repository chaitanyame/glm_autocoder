/**
 * Spec Editor Panel Component
 * 
 * CodeMirror-based editor for viewing and editing the app_spec.txt file.
 * Provides XML syntax highlighting for the spec format.
 */

import { useState, useEffect, useCallback } from 'react'
import { Save, RotateCcw, FileWarning, Check, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import * as api from '../lib/api'
import { useProject } from '../hooks/useProjects'

interface SpecEditorPanelProps {
  projectName: string
}

export function SpecEditorPanel({ projectName }: SpecEditorPanelProps) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  
  // Fetch project to get spec_status
  const { data: project } = useProject(projectName)

  const isDirty = content !== originalContent

  // Load the spec file
  const loadSpec = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const specContent = await api.loadFile(projectName, 'prompts/app_spec.txt')
      setContent(specContent)
      setOriginalContent(specContent)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load spec file'
      setError(message)
      // Set empty content if file doesn't exist
      if (message.includes('not found') || message.includes('404')) {
        setContent('')
        setOriginalContent('')
        setError('No spec file found. Create one using the Spec Creation wizard.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [projectName])

  useEffect(() => {
    loadSpec()
  }, [loadSpec])

  // Save the spec file
  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    try {
      await api.saveFile(projectName, 'prompts/app_spec.txt', content)
      setOriginalContent(content)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      setSaveStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  // Revert changes
  const handleRevert = () => {
    setContent(originalContent)
    setSaveStatus('idle')
  }

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty && !isSaving) {
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, isSaving, content])

  // Check if dark mode
  const isDarkMode = document.documentElement.classList.contains('dark')

  // Get spec status from project
  const specStatus = project?.spec_status || 'missing'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Spec Status Sticker - shown at top for imported projects */}
      {specStatus !== 'missing' && (
        <div className={`
          flex items-center gap-2 px-3 py-2
          border-b border-[var(--color-border-subtle)]
          ${specStatus === 'valid' 
            ? 'bg-[var(--color-neo-done)]/10' 
            : 'bg-[var(--color-neo-pending)]/10'
          }
        `}>
          {specStatus === 'valid' ? (
            <>
              <CheckCircle2 size={14} className="text-[var(--color-neo-done)]" />
              <span className="text-xs font-bold text-[var(--color-neo-done)]">
                Spec OK
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                — Specification is complete and valid
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={14} className="text-[var(--color-neo-pending)]" />
              <span className="text-xs font-bold text-[var(--color-neo-pending)]">
                Needs Review
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                — Specification may be incomplete or outdated
              </span>
            </>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="
        flex items-center justify-between gap-2 px-3 py-2
        border-b border-[var(--color-border-subtle)]
        bg-[var(--color-bg-tertiary)]
      ">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--color-text-secondary)]">
            prompts/app_spec.txt
          </span>
          {isDirty && (
            <span className="
              text-[10px] px-1.5 py-0.5 
              bg-[var(--color-status-pending)] 
              text-white rounded font-bold
            ">
              Modified
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="
              text-[10px] px-1.5 py-0.5 
              bg-[var(--color-status-done)] 
              text-white rounded font-bold
              flex items-center gap-1
            ">
              <Check size={10} />
              Saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleRevert}
            disabled={!isDirty || isSaving}
            className="
              neo-btn neo-btn-ghost p-1.5
              disabled:opacity-30 disabled:cursor-not-allowed
            "
            title="Revert changes"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="
              neo-btn neo-btn-primary p-1.5 px-3
              flex items-center gap-1.5
              disabled:opacity-30 disabled:cursor-not-allowed
            "
            title="Save (Ctrl+S)"
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            <span className="text-xs">Save</span>
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 size={32} className="animate-spin text-[var(--color-accent-primary)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading spec file...</p>
          </div>
        ) : error && !content ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
            <FileWarning size={48} className="text-[var(--color-status-pending)]" />
            <p className="text-sm text-[var(--color-text-secondary)] text-center">{error}</p>
            <button onClick={loadSpec} className="neo-btn text-sm">
              Try Again
            </button>
          </div>
        ) : (
          <CodeMirror
            value={content}
            height="100%"
            theme={isDarkMode ? oneDark : undefined}
            extensions={[xml(), EditorView.lineWrapping]}
            onChange={(value) => setContent(value)}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightSpecialChars: true,
              foldGutter: true,
              drawSelection: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: false,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              closeBracketsKeymap: true,
              defaultKeymap: true,
              searchKeymap: true,
              historyKeymap: true,
              foldKeymap: true,
              completionKeymap: true,
              lintKeymap: true,
            }}
            style={{
              fontSize: '13px',
              fontFamily: 'var(--font-neo-mono)',
            }}
            className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
          />
        )}
      </div>

      {/* Status bar */}
      <div className="
        flex items-center justify-between px-3 py-1.5
        border-t border-[var(--color-border-subtle)]
        bg-[var(--color-bg-tertiary)]
        text-[10px] text-[var(--color-text-secondary)]
        font-mono
      ">
        <span>
          {content.split('\n').length} lines
        </span>
        <span>
          {content.length} characters
        </span>
      </div>
    </div>
  )
}
