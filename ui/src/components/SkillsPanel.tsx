/**
 * Skills Panel Component
 * 
 * Manages Claude Skills for a project:
 * - Shows recommended skills based on tech stack (with checkboxes)
 * - Displays existing skills (with edit buttons)
 * - Generates skills sequentially with progress updates
 * - Provides CodeMirror editor for inline skill editing
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  Sparkles, Loader2, CheckCircle2, AlertCircle, Save, RotateCcw,
  ChevronRight, FileCode, Check, X
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import * as api from '../lib/api'
import type { SkillRecommendation, SkillInfo, SkillGenerationEvent } from '../lib/types'

interface SkillsPanelProps {
  projectName: string
}

export function SkillsPanel({ projectName }: SkillsPanelProps) {
  // Recommendations state
  const [recommendations, setRecommendations] = useState<SkillRecommendation[]>([])
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true)
  const [recommendationError, setRecommendationError] = useState<string | null>(null)
  
  // Existing skills state
  const [existingSkills, setExistingSkills] = useState<SkillInfo[]>([])
  const [isLoadingExisting, setIsLoadingExisting] = useState(true)
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<string>('')
  const [generationError, setGenerationError] = useState<string | null>(null)
  
  // Editor state
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [skillContent, setSkillContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  
  const isDirty = skillContent !== originalContent
  
  // Load recommendations on mount
  useEffect(() => {
    loadRecommendations()
    loadExistingSkills()
  }, [projectName])
  
  const loadRecommendations = async () => {
    setIsLoadingRecommendations(true)
    setRecommendationError(null)
    try {
      const recs = await api.getSkillRecommendations(projectName)
      setRecommendations(recs)
      
      // Auto-select all recommendations
      setSelectedSkills(new Set(recs.map(r => r.name)))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recommendations'
      setRecommendationError(message)
    } finally {
      setIsLoadingRecommendations(false)
    }
  }
  
  const loadExistingSkills = async () => {
    setIsLoadingExisting(true)
    try {
      const skills = await api.listSkills(projectName)
      setExistingSkills(skills)
    } catch (err) {
      console.error('Failed to load existing skills:', err)
      setExistingSkills([])
    } finally {
      setIsLoadingExisting(false)
    }
  }
  
  const toggleSkillSelection = (skillName: string) => {
    const newSelection = new Set(selectedSkills)
    if (newSelection.has(skillName)) {
      newSelection.delete(skillName)
    } else {
      newSelection.add(skillName)
    }
    setSelectedSkills(newSelection)
  }
  
  const handleGenerateSkills = async () => {
    if (selectedSkills.size === 0) return
    
    setIsGenerating(true)
    setGenerationError(null)
    setGenerationProgress('Starting generation...')
    
    try {
      const eventSource = api.generateSkillsStream(projectName, Array.from(selectedSkills))
      
      eventSource.addEventListener('message', (event: Event) => {
        const messageEvent = event as MessageEvent
        try {
          const data: SkillGenerationEvent = JSON.parse(messageEvent.data)
          
          switch (data.type) {
            case 'skill_start':
              setGenerationProgress(
                `Generating ${data.skill_name} (${(data.index ?? 0) + 1}/${data.total})...`
              )
              break
              
            case 'status':
              if (data.message) {
                setGenerationProgress(data.message)
              }
              break
              
            case 'skill_complete':
              setGenerationProgress(`✓ ${data.skill_name} complete`)
              // Refresh existing skills list
              loadExistingSkills()
              break
              
            case 'complete':
              setGenerationProgress(`✓ All ${data.count} skills generated successfully`)
              setIsGenerating(false)
              // Clear selections
              setSelectedSkills(new Set())
              // Refresh both lists
              loadRecommendations()
              loadExistingSkills()
              eventSource.close()
              break
              
            case 'error':
              setGenerationError(data.message || 'Generation failed')
              setIsGenerating(false)
              eventSource.close()
              break
          }
        } catch (parseError) {
          console.error('Failed to parse SSE message:', parseError)
        }
      })
      
      eventSource.addEventListener('error', () => {
        setGenerationError('Connection error during generation')
        setIsGenerating(false)
        eventSource.close()
      })
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate skills'
      setGenerationError(message)
      setIsGenerating(false)
    }
  }
  
  const loadSkillContent = useCallback(async (skillName: string) => {
    setIsLoadingContent(true)
    setSaveStatus('idle')
    try {
      const content = await api.getSkillContent(projectName, skillName)
      setSkillContent(content)
      setOriginalContent(content)
    } catch (err) {
      console.error(`Failed to load skill ${skillName}:`, err)
      setSkillContent('')
      setOriginalContent('')
    } finally {
      setIsLoadingContent(false)
    }
  }, [projectName])
  
  const handleSkillClick = (skillName: string) => {
    setSelectedSkill(skillName)
    loadSkillContent(skillName)
  }
  
  const handleSave = async () => {
    if (!selectedSkill) return
    
    setIsSaving(true)
    setSaveStatus('idle')
    try {
      await api.updateSkillContent(projectName, selectedSkill, skillContent)
      setOriginalContent(skillContent)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      
      // Refresh existing skills list
      loadExistingSkills()
    } catch (err) {
      console.error('Failed to save skill:', err)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleRevert = () => {
    setSkillContent(originalContent)
    setSaveStatus('idle')
  }
  
  return (
    <div className="flex h-full bg-[var(--color-bg-secondary)]">
      {/* Left Sidebar - Skill Selection */}
      <div className="w-80 border-r-3 border-[var(--color-neo-border)] bg-[var(--color-bg-primary)] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b-3 border-[var(--color-neo-border)]">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={20} className="text-[var(--color-accent-tertiary)]" />
            <h2 className="font-display font-bold text-lg">Skills</h2>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            AI-generated guidance for your tech stack
          </p>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Recommended Skills Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm uppercase tracking-wide text-[var(--color-text-secondary)]">
                Recommended
              </h3>
              {isLoadingRecommendations && (
                <Loader2 size={14} className="animate-spin" />
              )}
            </div>
            
            {recommendationError && (
              <div className="p-3 bg-[var(--color-status-error)] border-2 border-[var(--color-neo-border)] mb-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{recommendationError}</p>
                </div>
              </div>
            )}
            
            {!isLoadingRecommendations && recommendations.length === 0 && !recommendationError && (
              <p className="text-sm text-[var(--color-text-secondary)] italic">
                No recommendations available
              </p>
            )}
            
            <div className="space-y-2">
              {recommendations.map((rec) => {
                const isSelected = selectedSkills.has(rec.name)
                const alreadyExists = existingSkills.some(s => s.name === rec.name)
                
                return (
                  <div
                    key={rec.name}
                    className={`
                      border-2 border-[var(--color-neo-border)] p-3 cursor-pointer
                      transition-all duration-150
                      ${isSelected && !alreadyExists
                        ? 'bg-[var(--color-accent-tertiary)] text-black'
                        : alreadyExists
                        ? 'bg-[var(--color-bg-tertiary)] opacity-50 cursor-not-allowed'
                        : 'bg-[var(--color-bg-secondary)] hover:translate-x-0.5 hover:translate-y-0.5'
                      }
                    `}
                    style={{
                      boxShadow: isSelected && !alreadyExists
                        ? '3px 3px 0px rgba(0,0,0,1)'
                        : 'none'
                    }}
                    onClick={() => !alreadyExists && toggleSkillSelection(rec.name)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`
                        w-5 h-5 border-2 border-[var(--color-neo-border)] flex-shrink-0
                        flex items-center justify-center
                        ${isSelected && !alreadyExists ? 'bg-black' : 'bg-white'}
                      `}>
                        {isSelected && !alreadyExists && <Check size={14} className="text-[var(--color-accent-tertiary)]" />}
                        {alreadyExists && <Check size={14} className="text-[var(--color-text-secondary)]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-bold mb-1 flex items-center gap-2">
                          {rec.name}
                          {alreadyExists && (
                            <span className="text-xs font-normal text-[var(--color-text-secondary)]">
                              (exists)
                            </span>
                          )}
                        </div>
                        <p className="text-xs opacity-90">{rec.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Generate Button */}
            {selectedSkills.size > 0 && (
              <button
                onClick={handleGenerateSkills}
                disabled={isGenerating}
                className="neo-button mt-4 w-full bg-[var(--color-accent-tertiary)] hover:bg-[var(--color-accent-tertiary)] disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate {selectedSkills.size} Skill{selectedSkills.size > 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
            
            {/* Generation Progress */}
            {isGenerating && generationProgress && (
              <div className="mt-3 p-2 bg-[var(--color-bg-tertiary)] border-2 border-[var(--color-neo-border)] text-sm">
                {generationProgress}
              </div>
            )}
            
            {generationError && (
              <div className="mt-3 p-2 bg-[var(--color-status-error)] border-2 border-[var(--color-neo-border)] text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{generationError}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Existing Skills Section */}
          {existingSkills.length > 0 && (
            <div className="p-4 border-t-3 border-[var(--color-neo-border)]">
              <h3 className="font-bold text-sm uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
                Existing Skills
              </h3>
              
              <div className="space-y-2">
                {existingSkills.map((skill) => (
                  <button
                    key={skill.name}
                    onClick={() => handleSkillClick(skill.name)}
                    className={`
                      w-full text-left border-2 border-[var(--color-neo-border)] p-3
                      transition-all duration-150
                      ${selectedSkill === skill.name
                        ? 'bg-[var(--color-neo-progress)] text-black'
                        : 'bg-[var(--color-bg-secondary)] hover:translate-x-0.5 hover:translate-y-0.5'
                      }
                    `}
                    style={{
                      boxShadow: selectedSkill === skill.name
                        ? '3px 3px 0px rgba(0,0,0,1)'
                        : 'none'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode size={14} />
                        <span className="font-mono text-sm">{skill.name}</span>
                      </div>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Right Panel - Editor */}
      <div className="flex-1 flex flex-col">
        {selectedSkill ? (
          <>
            {/* Editor Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b-3 border-[var(--color-neo-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono font-bold">{selectedSkill}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Edit skill guidance
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {saveStatus === 'saved' && (
                    <div className="flex items-center gap-1 text-[var(--color-status-done)] text-sm">
                      <CheckCircle2 size={16} />
                      Saved
                    </div>
                  )}
                  {saveStatus === 'error' && (
                    <div className="flex items-center gap-1 text-[var(--color-status-error)] text-sm">
                      <AlertCircle size={16} />
                      Error
                    </div>
                  )}
                  
                  {isDirty && (
                    <button
                      onClick={handleRevert}
                      className="neo-button-secondary"
                      title="Revert changes"
                    >
                      <RotateCcw size={14} />
                      Revert
                    </button>
                  )}
                  
                  <button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="neo-button"
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save
                  </button>
                </div>
              </div>
            </div>
            
            {/* CodeMirror Editor */}
            <div className="flex-1 overflow-hidden">
              {isLoadingContent ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : (
                <CodeMirror
                  value={skillContent}
                  height="100%"
                  theme={oneDark}
                  extensions={[markdown(), EditorView.lineWrapping]}
                  onChange={(value) => setSkillContent(value)}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightSpecialChars: true,
                    foldGutter: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    closeBracketsKeymap: true,
                    searchKeymap: true,
                    foldKeymap: true,
                    completionKeymap: true,
                    lintKeymap: true,
                  }}
                />
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="h-full flex items-center justify-center text-center p-8">
            <div>
              <Sparkles size={48} className="mx-auto mb-4 text-[var(--color-text-secondary)] opacity-50" />
              <h3 className="font-bold text-lg mb-2">No Skill Selected</h3>
              <p className="text-sm text-[var(--color-text-secondary)] max-w-md">
                {existingSkills.length > 0
                  ? 'Select an existing skill to view and edit, or generate new skills from recommendations.'
                  : selectedSkills.size > 0
                  ? 'Click "Generate" to create skills, then select one to edit.'
                  : 'Select recommended skills and click "Generate" to get started.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
