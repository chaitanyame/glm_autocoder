/**
 * Sidebar Component
 * 
 * Collapsible left sidebar with icon rail and panel content areas.
 * Contains: Ideation, Backlog, Spec Editor, Terminal
 */

import { useCallback } from 'react'
import {
  LayoutGrid,
  Lightbulb,
  LayoutList,
  FileCode,
  Terminal,
  Bot,
  Sparkles,
} from 'lucide-react'

export type SidebarPanel = 'board' | 'ideation' | 'backlog' | 'spec-editor' | 'terminal' | 'assistant' | 'skills' | null

interface SidebarProps {
  isOpen: boolean
  activePanel: SidebarPanel
  onToggle: () => void
  onPanelChange: (panel: SidebarPanel) => void
}

interface SidebarItem {
  id: SidebarPanel
  label: string
  icon: React.ReactNode
  shortcut: string
  color: string
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { 
    id: 'board', 
    label: 'Board', 
    icon: <LayoutGrid size={20} />, 
    shortcut: 'M',
    color: 'var(--color-accent-primary)'
  },
  { 
    id: 'ideation', 
    label: 'Ideation', 
    icon: <Lightbulb size={20} />, 
    shortcut: 'I',
    color: 'var(--color-status-pending)'
  },
  { 
    id: 'backlog', 
    label: 'Backlog', 
    icon: <LayoutList size={20} />, 
    shortcut: 'B',
    color: 'var(--color-accent-secondary)'
  },
  { 
    id: 'spec-editor', 
    label: 'Spec Editor', 
    icon: <FileCode size={20} />, 
    shortcut: 'E',
    color: 'var(--color-accent-tertiary)'
  },
  { 
    id: 'terminal', 
    label: 'Terminal', 
    icon: <Terminal size={20} />, 
    shortcut: 'T',
    color: 'var(--color-status-done)'
  },
  {
    id: 'assistant',
    label: 'Assistant',
    icon: <Bot size={20} />,
    shortcut: 'A',
    color: 'var(--color-status-pending)'
  },
  { 
    id: 'skills', 
    label: 'Skills', 
    icon: <Sparkles size={20} />, 
    shortcut: 'K',
    color: 'var(--color-accent-tertiary)'
  },
]

export function Sidebar({ 
  isOpen, 
  activePanel, 
  onToggle, 
  onPanelChange 
}: SidebarProps) {
  const handleItemClick = useCallback((panel: SidebarPanel) => {
    onPanelChange(panel)
    if (!isOpen) {
      onToggle()
    }
  }, [activePanel, isOpen, onPanelChange, onToggle])

  return (
    <>
      {/* Sidebar container */}
      <div 
        className={`
          fixed left-0 z-40
          flex transition-all duration-300 ease-out
          translate-x-0
          overflow-y-auto overflow-x-hidden
        `}
        style={{ top: '72px', bottom: 0 }}
      >
        {/* Navigation rail with labels */}
        <div className="
          w-56 bg-[var(--color-bg-secondary)]
          border-r-3 border-[var(--color-border-default)]
          flex flex-col py-3 px-2 gap-1
          shadow-[var(--shadow-neo-sm)]
        ">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Panels
          </div>
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`
                w-full h-11 rounded-lg
                flex items-center gap-3 px-3
                transition-all duration-150
                border-2
                ${activePanel === item.id 
                  ? 'bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] shadow-[var(--shadow-neo-sm)]' 
                  : 'border-transparent hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-subtle)]'
                }
              `}
              style={{ 
                color: activePanel === item.id ? item.color : 'var(--color-text-secondary)' 
              }}
              title={`${item.label} (${item.shortcut})`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="text-sm font-semibold tracking-tight">
                {item.label}
              </span>
              <span className="ml-auto text-[10px] font-mono opacity-60">
                {item.shortcut}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
