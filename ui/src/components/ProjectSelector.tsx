import { useState } from 'react'
import { ChevronDown, Plus, FolderOpen, Loader2, Trash2, FolderInput } from 'lucide-react'
import type { ProjectSummary } from '../lib/types'
import { NewProjectModal } from './NewProjectModal'
import { ImportProjectModal } from './ImportProjectModal'
import { useDeleteProject } from '../hooks/useProjects'

interface ProjectSelectorProps {
  projects: ProjectSummary[]
  selectedProject: string | null
  onSelectProject: (name: string | null) => void
  isLoading: boolean
}

export function ProjectSelector({
  projects,
  selectedProject,
  onSelectProject,
  isLoading,
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  const deleteProject = useDeleteProject()

  const handleProjectCreated = (projectName: string) => {
    onSelectProject(projectName)
    setIsOpen(false)
  }

  const handleProjectImported = (projectName: string) => {
    onSelectProject(projectName)
    setIsOpen(false)
  }

  const handleDeleteProject = (projectName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirm(projectName)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteProject.mutate(deleteConfirm, {
        onSuccess: () => {
          if (selectedProject === deleteConfirm) {
            onSelectProject(null)
          }
          setDeleteConfirm(null)
        },
      })
    }
  }

  const selectedProjectData = projects.find(p => p.name === selectedProject)

  return (
    <div className="relative">
      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="neo-btn bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] w-full md:min-w-[200px] md:w-auto justify-between"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : selectedProject ? (
          <>
            <span className="flex items-center gap-2">
              <FolderOpen size={18} />
              {selectedProject}
            </span>
            {selectedProjectData && selectedProjectData.stats.total > 0 && (
              <span className="neo-badge bg-[var(--color-status-done)] text-[#1a1a1a] ml-2">
                {selectedProjectData.stats.percentage}%
              </span>
            )}
          </>
        ) : (
          <span className="text-[var(--color-text-secondary)]">
            Select Project
          </span>
        )}
        <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-full neo-dropdown z-50 md:min-w-[280px] max-w-[calc(100vw-2rem)]">
            {projects.length > 0 ? (
              <div className="max-h-[300px] overflow-auto">
                {projects.map(project => (
                  <div
                    key={project.name}
                    className={`neo-dropdown-item flex items-center justify-between group ${
                      project.name === selectedProject
                        ? 'bg-[var(--color-neo-pending)]'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        onSelectProject(project.name)
                        setIsOpen(false)
                      }}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <FolderOpen size={16} />
                      {project.name}
                      {project.stats.total > 0 && (
                        <span className="text-sm font-mono ml-auto mr-2">
                          {project.stats.passing}/{project.stats.total}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(project.name, e)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-red-500 rounded transition-all ml-2"
                      title="Delete project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-[var(--color-neo-text-secondary)]">
                No projects yet
              </div>
            )}

            {/* Divider */}
            <div className="border-t-3 border-[var(--color-neo-border)]" />

            {/* Create New */}
            <button
              onClick={() => {
                setShowNewProjectModal(true)
                setIsOpen(false)
              }}
              className="w-full neo-dropdown-item flex items-center gap-2 font-bold"
            >
              <Plus size={16} />
              New Project
            </button>

            {/* Import Existing */}
            <button
              onClick={() => {
                setShowImportModal(true)
                setIsOpen(false)
              }}
              className="w-full neo-dropdown-item flex items-center gap-2 font-bold"
            >
              <FolderInput size={16} />
              Import Existing
            </button>
          </div>
        </>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Import Project Modal */}
      <ImportProjectModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onProjectImported={handleProjectImported}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 neo-card bg-white p-6 w-[calc(100vw-2rem)] max-w-[400px]">
            <h3 className="text-lg font-bold mb-4">Delete Project</h3>
            <p className="text-[var(--color-neo-text-secondary)] mb-6">
              Are you sure you want to delete <strong>{deleteConfirm}</strong>?
              <br />
              <span className="text-sm">This will remove the project from the registry. Project files will not be deleted.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="neo-btn bg-white"
                disabled={deleteProject.isPending}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="neo-btn bg-red-500 text-white hover:bg-red-600"
                disabled={deleteProject.isPending}
              >
                {deleteProject.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
