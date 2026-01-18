import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProjects, useFeatures, useAgentStatus } from './hooks/useProjects'
import { useProjectWebSocket } from './hooks/useWebSocket'
import { useFeatureSound } from './hooks/useFeatureSound'
import { useCelebration } from './hooks/useCelebration'
import { useTheme } from './hooks/useTheme'

const STORAGE_KEY = 'autocoder-selected-project'
import { ProjectSelector } from './components/ProjectSelector'
import { KanbanBoard } from './components/KanbanBoard'
import { AgentControl } from './components/AgentControl'
import { ProgressDashboard } from './components/ProgressDashboard'
import { SetupWizard } from './components/SetupWizard'
import { AddFeatureForm } from './components/AddFeatureForm'
import { FeatureModal } from './components/FeatureModal'
import { DebugLogViewer } from './components/DebugLogViewer'
import { AgentThought } from './components/AgentThought'
import { AssistantChat } from './components/AssistantChat'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar, type SidebarPanel } from './components/Sidebar'
import { IdeationPanel } from './components/IdeationPanel'
import { BacklogPanel } from './components/BacklogPanel'
import { SpecEditorPanel } from './components/SpecEditorPanel'
import { TerminalPanel } from './components/TerminalPanel'
import { Plus, Loader2, Settings, Moon, Sun, Menu, X, Bot } from 'lucide-react'
import type { Feature } from './lib/types'

function App() {
  const { theme, toggleTheme } = useTheme()
  
  // Initialize selected project from localStorage
  const [selectedProject, setSelectedProject] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [setupComplete, setSetupComplete] = useState(true) // Start optimistic
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugPanelHeight, setDebugPanelHeight] = useState(288) // Default height
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<SidebarPanel>('board')

  const queryClient = useQueryClient()
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: features } = useFeatures(selectedProject)
  const { data: agentStatusData } = useAgentStatus(selectedProject)
  
  // Callback to invalidate features cache when WebSocket receives feature_update
  const handleFeatureUpdate = useCallback(() => {
    if (selectedProject) {
      queryClient.invalidateQueries({ queryKey: ['features', selectedProject] })
    }
  }, [queryClient, selectedProject])
  
  const wsState = useProjectWebSocket(selectedProject, handleFeatureUpdate)

  // Play sounds when features move between columns
  useFeatureSound(features)

  // Celebrate when all features are complete
  useCelebration(features, selectedProject)

  // Persist selected project to localStorage
  const handleSelectProject = useCallback((project: string | null) => {
    setSelectedProject(project)
    setActiveSidebarPanel(project ? 'board' : null)
    try {
      if (project) {
        localStorage.setItem(STORAGE_KEY, project)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  // Validate stored project exists (clear if project was deleted)
  useEffect(() => {
    if (selectedProject && projects && !projects.some(p => p.name === selectedProject)) {
      handleSelectProject(null)
    }
  }, [selectedProject, projects, handleSelectProject])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // D : Toggle debug window
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        setDebugOpen(prev => !prev)
      }

      // N : Add new feature (when project selected)
      if ((e.key === 'n' || e.key === 'N') && selectedProject) {
        e.preventDefault()
        setShowAddFeature(true)
      }

      // S : Toggle settings modal
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setSettingsOpen(prev => !prev)
      }

      // Sidebar panel shortcuts (when project selected)
      if (selectedProject) {
        // M : Board view
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault()
          setActiveSidebarPanel('board')
        }

        // I : Ideation panel
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault()
          setActiveSidebarPanel(prev => prev === 'ideation' ? 'board' : 'ideation')
        }
        
        // B : Backlog panel
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault()
          setActiveSidebarPanel(prev => prev === 'backlog' ? 'board' : 'backlog')
        }
        
        // E : Spec Editor panel
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault()
          setActiveSidebarPanel(prev => prev === 'spec-editor' ? 'board' : 'spec-editor')
        }
        
        // T : Terminal panel
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault()
          setActiveSidebarPanel(prev => prev === 'terminal' ? 'board' : 'terminal')
        }

        // A : Assistant panel
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault()
          setActiveSidebarPanel(prev => prev === 'assistant' ? 'board' : 'assistant')
        }
      }

      // Escape : Close modals
      if (e.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false)
        } else if (showAddFeature) {
          setShowAddFeature(false)
        } else if (selectedFeature) {
          setSelectedFeature(null)
        } else if (activeSidebarPanel && activeSidebarPanel !== 'board') {
          setActiveSidebarPanel('board')
        } else if (debugOpen) {
          setDebugOpen(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedProject, showAddFeature, selectedFeature, debugOpen, settingsOpen, activeSidebarPanel])

  // Combine WebSocket progress with feature data
  const progress = wsState.progress.total > 0 ? wsState.progress : {
    passing: features?.done.length ?? 0,
    total: (features?.pending.length ?? 0) + (features?.in_progress.length ?? 0) + (features?.done.length ?? 0),
    percentage: 0,
  }

  if (progress.total > 0 && progress.percentage === 0) {
    progress.percentage = Math.round((progress.passing / progress.total) * 100 * 10) / 10
  }

  if (!setupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />
  }

  const renderMainPanel = () => {
    switch (activeSidebarPanel) {
      case 'ideation':
        return <IdeationPanel projectName={selectedProject ?? ''} />
      case 'backlog':
        return <BacklogPanel projectName={selectedProject ?? ''} />
      case 'spec-editor':
        return <SpecEditorPanel projectName={selectedProject ?? ''} />
      case 'terminal':
        return <TerminalPanel projectName={selectedProject ?? ''} />
      case 'assistant':
        return (
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b-3 border-[var(--color-neo-border)] bg-[var(--color-neo-progress)]">
              <div className="flex items-center gap-2">
                <div className="bg-white border-2 border-[var(--color-neo-border)] p-1.5 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <Bot size={18} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-white">Project Assistant</h2>
                  <p className="text-xs text-white/80 font-mono">{selectedProject}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <AssistantChat projectName={selectedProject ?? ''} />
            </div>
          </div>
        )
      default:
        return (
          <KanbanBoard
            features={features}
            onFeatureClick={setSelectedFeature}
          />
        )
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#1a1a2e] text-white border-b-4 border-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight uppercase">
              AutoCoder
            </h1>

            {/* Desktop Controls - hidden on mobile */}
            <div className="hidden md:flex items-center gap-4">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md hover:bg-white/10 transition-colors"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={20} color="#ffffff" /> : <Sun size={20} color="#ffffff" />}
              </button>
              
              {/* Settings Button */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-md hover:bg-white/10 transition-colors"
                title="Settings"
              >
                <Settings size={20} color="#ffffff" />
              </button>

              <ProjectSelector
                projects={projects ?? []}
                selectedProject={selectedProject}
                onSelectProject={handleSelectProject}
                isLoading={projectsLoading}
              />

              {selectedProject && (
                <>
                  <button
                    onClick={() => setShowAddFeature(true)}
                    className="neo-btn neo-btn-primary text-sm"
                    title="Press N"
                  >
                    <Plus size={18} />
                    Add Feature
                    <kbd className="ml-1.5 px-1.5 py-0.5 text-xs bg-black/20 rounded font-mono">
                      N
                    </kbd>
                  </button>

                  <AgentControl
                    projectName={selectedProject}
                    status={wsState.agentStatus}
                    yoloMode={agentStatusData?.yolo_mode ?? false}
                    isConnected={wsState.isConnected}
                  />
                </>
              )}
            </div>

            {/* Mobile hamburger button - visible only on mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-white/20 space-y-3 animate-slide-in">
              {/* Project Selector - full width on mobile */}
              <div className="w-full">
                <ProjectSelector
                  projects={projects ?? []}
                  selectedProject={selectedProject}
                  onSelectProject={(name) => {
                    handleSelectProject(name)
                    setIsMobileMenuOpen(false)
                  }}
                  isLoading={projectsLoading}
                />
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-2">
                {/* Dark Mode Toggle */}
                <button
                  onClick={toggleTheme}
                  className="p-3 rounded-md hover:bg-white/10 transition-colors"
                  title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                  {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
                
                {/* Settings Button */}
                <button
                  onClick={() => {
                    setSettingsOpen(true)
                    setIsMobileMenuOpen(false)
                  }}
                  className="p-3 rounded-md hover:bg-white/10 transition-colors"
                  title="Settings"
                >
                  <Settings size={20} />
                </button>

                {selectedProject && (
                  <button
                    onClick={() => {
                      setShowAddFeature(true)
                      setIsMobileMenuOpen(false)
                    }}
                    className="neo-btn neo-btn-primary text-sm flex-1"
                    title="Add Feature"
                  >
                    <Plus size={18} />
                    Add Feature
                  </button>
                )}
              </div>

              {/* Agent Control - full width */}
              {selectedProject && (
                <div className="w-full">
                  <AgentControl
                    projectName={selectedProject}
                    status={wsState.agentStatus}
                    yoloMode={agentStatusData?.yolo_mode ?? false}
                    isConnected={wsState.isConnected}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Sidebar */}
      {selectedProject && (
        <Sidebar
          isOpen={true}
          activePanel={activeSidebarPanel}
          onToggle={() => undefined}
          onPanelChange={setActiveSidebarPanel}
        />
      )}

      {/* Main Content */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-8 transition-all duration-300"
        style={{ 
          paddingBottom: debugOpen ? debugPanelHeight + 32 : undefined,
          marginLeft: selectedProject ? '224px' : undefined,
        }}
      >
        {!selectedProject ? (
          <div className="neo-empty-state mt-12">
            <h2 className="font-display text-2xl font-bold mb-2">
              Welcome to AutoCoder
            </h2>
            <p className="text-[var(--color-neo-text-secondary)] mb-4">
              Select a project from the dropdown above or create a new one to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {(activeSidebarPanel === 'board' || !activeSidebarPanel) && (
              <>
                {/* Progress Dashboard */}
                <ProgressDashboard
                  passing={progress.passing}
                  total={progress.total}
                  percentage={progress.percentage}
                  isConnected={wsState.isConnected}
                  hostPath={projects?.find(p => p.name === selectedProject)?.host_path}
                  projectName={selectedProject}
                />

                {/* Agent Thought - shows latest agent narrative */}
                <AgentThought
                  logs={wsState.logs}
                  agentStatus={wsState.agentStatus}
                />

                {/* Initializing Features State - show when agent is running but no features yet */}
                {features &&
                 features.pending.length === 0 &&
                 features.in_progress.length === 0 &&
                 features.done.length === 0 &&
                 wsState.agentStatus === 'running' && (
                  <div className="neo-card p-8 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto mb-4 text-[var(--color-neo-progress)]" />
                    <h3 className="font-display font-bold text-xl mb-2">
                      Initializing Features...
                    </h3>
                    <p className="text-[var(--color-neo-text-secondary)]">
                      The agent is reading your spec and creating features. This may take a moment.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Main panel content */}
            {activeSidebarPanel === 'board' || !activeSidebarPanel ? (
              renderMainPanel()
            ) : (
              <div className="neo-card p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
                {renderMainPanel()}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Feature Modal */}
      {showAddFeature && selectedProject && (
        <AddFeatureForm
          projectName={selectedProject}
          onClose={() => setShowAddFeature(false)}
        />
      )}

      {/* Feature Detail Modal */}
      {selectedFeature && selectedProject && (
        <FeatureModal
          feature={selectedFeature}
          projectName={selectedProject}
          onClose={() => setSelectedFeature(null)}
        />
      )}

      {/* Debug Log Viewer - fixed to bottom */}
      {selectedProject && (
        <DebugLogViewer
          logs={wsState.logs}
          isOpen={debugOpen}
          onToggle={() => setDebugOpen(!debugOpen)}
          onClear={wsState.clearLogs}
          onHeightChange={setDebugPanelHeight}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

export default App
