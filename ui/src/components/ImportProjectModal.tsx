/**
 * Import Project Modal Component
 *
 * Multi-step modal for importing existing projects:
 * 1. Select existing project folder
 * 2. Confirm/edit project name (auto-detected from folder)
 * 3. Import and show result
 */

import { useState } from 'react'
import { X, FolderInput, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Folder, AlertCircle } from 'lucide-react'
import { useImportProject } from '../hooks/useProjects'
import { FolderBrowser } from './FolderBrowser'

type Step = 'folder' | 'confirm' | 'complete' | 'error'

interface ImportProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onProjectImported: (projectName: string) => void
}

export function ImportProjectModal({
  isOpen,
  onClose,
  onProjectImported,
}: ImportProjectModalProps) {
  const [step, setStep] = useState<Step>('folder')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [specStatus, setSpecStatus] = useState<'valid' | 'needs_review' | 'missing'>('missing')

  const importProject = useImportProject()

  if (!isOpen) return null

  const handleFolderSelect = (path: string) => {
    setProjectPath(path)
    // Extract folder name for default project name
    const folderName = path.split('/').filter(Boolean).pop() || 'project'
    // Sanitize the name to match the allowed pattern
    const sanitizedName = folderName.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)
    setProjectName(sanitizedName)
    setStep('confirm')
    setError(null)
  }

  const handleFolderCancel = () => {
    handleClose()
  }

  const handleImport = async () => {
    if (!projectPath) {
      setError('Please select a project folder first')
      setStep('folder')
      return
    }

    try {
      const result = await importProject.mutateAsync({
        path: projectPath,
        name: projectName.trim() || undefined,
        analyzeSpec: true,
      })
      setSpecStatus(result.spec_status || 'missing')
      setStep('complete')
      setTimeout(() => {
        onProjectImported(result.name)
        handleClose()
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import project')
      setStep('error')
    }
  }

  const handleClose = () => {
    setStep('folder')
    setProjectPath(null)
    setProjectName('')
    setError(null)
    setSpecStatus('missing')
    onClose()
  }

  const handleBack = () => {
    if (step === 'confirm' || step === 'error') {
      setStep('folder')
      setError(null)
    }
  }

  const handleRetry = () => {
    setError(null)
    setStep('confirm')
  }

  // Folder selection step uses larger modal
  if (step === 'folder') {
    return (
      <div className="neo-modal-backdrop" onClick={handleClose}>
        <div
          className="neo-modal w-full max-w-3xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b-3 border-[var(--color-neo-border)]">
            <div className="flex items-center gap-3">
              <FolderInput size={24} className="text-[var(--color-neo-progress)]" />
              <div>
                <h2 className="font-display font-bold text-xl text-[#1a1a1a]">
                  Import Existing Project
                </h2>
                <p className="text-sm text-[#4a4a4a]">
                  Select the root folder of your existing project
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="neo-btn neo-btn-ghost p-2"
            >
              <X size={20} />
            </button>
          </div>

          {/* Folder Browser */}
          <div className="flex-1 overflow-hidden">
            <FolderBrowser
              onSelect={handleFolderSelect}
              onCancel={handleFolderCancel}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="neo-modal-backdrop" onClick={handleClose}>
      <div
        className="neo-modal w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-3 border-[var(--color-neo-border)]">
          <h2 className="font-display font-bold text-xl text-[#1a1a1a]">
            {step === 'confirm' && 'Confirm Import'}
            {step === 'complete' && 'Project Imported!'}
            {step === 'error' && 'Import Failed'}
          </h2>
          <button
            onClick={handleClose}
            className="neo-btn neo-btn-ghost p-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Confirm Step */}
          {step === 'confirm' && (
            <div>
              <div className="mb-6 p-4 bg-[var(--color-bg-secondary)] border-2 border-[var(--color-neo-border)]">
                <div className="flex items-center gap-2 text-sm text-[var(--color-neo-text-secondary)] mb-2">
                  <Folder size={16} />
                  Selected folder:
                </div>
                <p className="font-mono text-sm break-all">{projectPath}</p>
              </div>

              <div className="mb-6">
                <label className="block font-bold mb-2 text-[#1a1a1a]">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-project"
                  className="neo-input"
                  pattern="^[a-zA-Z0-9_-]+$"
                />
                <p className="text-sm text-[var(--color-neo-text-secondary)] mt-2">
                  Auto-detected from folder name. You can change it if needed.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[var(--color-neo-danger)] text-white text-sm border-2 border-[var(--color-neo-border)]">
                  {error}
                </div>
              )}

              {importProject.isPending && (
                <div className="mb-4 flex items-center justify-center gap-2 text-[var(--color-neo-text-secondary)]">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Importing project...</span>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={handleBack}
                  className="neo-btn neo-btn-ghost"
                  disabled={importProject.isPending}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="neo-btn neo-btn-primary"
                  disabled={!projectName.trim() || importProject.isPending}
                >
                  {importProject.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Import Project
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-neo-done)] border-3 border-[var(--color-neo-border)] shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">
                {projectName}
              </h3>
              <p className="text-[var(--color-neo-text-secondary)] mb-4">
                Your project has been imported successfully!
              </p>
              
              {/* Spec status indicator */}
              <div className={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold
                ${specStatus === 'valid' 
                  ? 'bg-[var(--color-neo-done)] text-white' 
                  : specStatus === 'needs_review' 
                    ? 'bg-[var(--color-neo-pending)] text-[#1a1a1a]'
                    : 'bg-gray-200 text-gray-600'
                }
              `}>
                {specStatus === 'valid' && 'Spec OK'}
                {specStatus === 'needs_review' && 'Spec Needs Review'}
                {specStatus === 'missing' && 'No Spec Found'}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Redirecting...</span>
              </div>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-neo-danger)] border-3 border-[var(--color-neo-border)] shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-4">
                <AlertCircle size={32} className="text-white" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">
                Import Failed
              </h3>
              <p className="text-[var(--color-neo-text-secondary)] mb-4">
                {error || 'An unexpected error occurred'}
              </p>
              
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleBack}
                  className="neo-btn neo-btn-ghost"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  onClick={handleRetry}
                  className="neo-btn neo-btn-primary"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
