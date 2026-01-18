/**
 * Ideation Panel Component
 * 
 * AI-powered idea generation with category selection and prompt picking.
 * Generated ideas are reviewed before being added to the Backlog panel.
 */

import { useState } from 'react'
import { 
  Zap, Palette, Code, TrendingUp, Cpu, Shield, 
  Gauge, Accessibility, BarChart3, Loader2, Sparkles,
  ChevronRight, ArrowLeft, Trash2, AlertTriangle
} from 'lucide-react'
import * as api from '../lib/api'
import type { DraftIdea, Idea, IdeaCategory, IdeaPriority, IdeationPrompt } from '../lib/types'

interface IdeationPanelProps {
  projectName: string
}

interface CategoryWithIcon {
  id: IdeaCategory
  name: string
  icon: React.ReactNode
  description: string
}

// Category definitions with icons
const CATEGORIES: CategoryWithIcon[] = [
  { id: 'feature', name: 'Features', icon: <Zap size={20} />, description: 'New capabilities and functionality' },
  { id: 'ux-ui', name: 'UX/UI', icon: <Palette size={20} />, description: 'Design and user experience' },
  { id: 'dx', name: 'Developer Exp', icon: <Code size={20} />, description: 'Developer tooling and workflows' },
  { id: 'growth', name: 'Growth', icon: <TrendingUp size={20} />, description: 'User engagement and retention' },
  { id: 'technical', name: 'Technical', icon: <Cpu size={20} />, description: 'Architecture and infrastructure' },
  { id: 'security', name: 'Security', icon: <Shield size={20} />, description: 'Security improvements' },
  { id: 'performance', name: 'Performance', icon: <Gauge size={20} />, description: 'Speed optimization' },
  { id: 'accessibility', name: 'Accessibility', icon: <Accessibility size={20} />, description: 'Inclusive design' },
  { id: 'analytics', name: 'Analytics', icon: <BarChart3 size={20} />, description: 'Monitoring and insights' },
]

// Predefined prompts per category
const PROMPTS: Record<IdeaCategory, IdeationPrompt[]> = {
  feature: [
    { id: 'missing', category: 'feature', title: 'Missing Features', description: 'Identify features users typically expect' },
    { id: 'automation', category: 'feature', title: 'Automation', description: 'Manual processes that could be automated' },
    { id: 'integrations', category: 'feature', title: 'Integrations', description: 'Third-party services that add value' },
  ],
  'ux-ui': [
    { id: 'friction', category: 'ux-ui', title: 'Friction Points', description: 'Identify user friction points' },
    { id: 'empty-states', category: 'ux-ui', title: 'Empty States', description: 'Improve empty state experiences' },
    { id: 'visual', category: 'ux-ui', title: 'Visual Polish', description: 'Visual improvements and consistency' },
  ],
  dx: [
    { id: 'tooling', category: 'dx', title: 'Developer Tools', description: 'Improve developer experience' },
    { id: 'docs', category: 'dx', title: 'Documentation', description: 'Documentation improvements' },
    { id: 'testing', category: 'dx', title: 'Testing', description: 'Testing infrastructure improvements' },
  ],
  growth: [
    { id: 'onboarding', category: 'growth', title: 'Onboarding', description: 'Improve user onboarding flow' },
    { id: 'retention', category: 'growth', title: 'Retention', description: 'Features to increase retention' },
    { id: 'viral', category: 'growth', title: 'Viral Features', description: 'Features that encourage sharing' },
  ],
  technical: [
    { id: 'refactor', category: 'technical', title: 'Refactoring', description: 'Code quality improvements' },
    { id: 'architecture', category: 'technical', title: 'Architecture', description: 'Architectural improvements' },
    { id: 'debt', category: 'technical', title: 'Tech Debt', description: 'Technical debt reduction' },
  ],
  security: [
    { id: 'vulnerabilities', category: 'security', title: 'Vulnerabilities', description: 'Security vulnerability fixes' },
    { id: 'auth', category: 'security', title: 'Authentication', description: 'Auth and authorization improvements' },
    { id: 'data', category: 'security', title: 'Data Protection', description: 'Data security improvements' },
  ],
  performance: [
    { id: 'speed', category: 'performance', title: 'Speed', description: 'Performance bottlenecks to fix' },
    { id: 'caching', category: 'performance', title: 'Caching', description: 'Caching opportunities' },
    { id: 'bundle', category: 'performance', title: 'Bundle Size', description: 'Reduce bundle size' },
  ],
  accessibility: [
    { id: 'screen-reader', category: 'accessibility', title: 'Screen Readers', description: 'Screen reader improvements' },
    { id: 'keyboard', category: 'accessibility', title: 'Keyboard Nav', description: 'Keyboard navigation' },
    { id: 'contrast', category: 'accessibility', title: 'Contrast', description: 'Color contrast improvements' },
  ],
  analytics: [
    { id: 'metrics', category: 'analytics', title: 'Key Metrics', description: 'Important metrics to track' },
    { id: 'events', category: 'analytics', title: 'Event Tracking', description: 'User events to track' },
    { id: 'dashboards', category: 'analytics', title: 'Dashboards', description: 'Dashboard improvements' },
  ],
}

type ViewMode = 'categories' | 'prompts' | 'generating' | 'review'

export function IdeationPanel({ projectName }: IdeationPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('categories')
  const [selectedCategory, setSelectedCategory] = useState<IdeaCategory | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [draftIdeas, setDraftIdeas] = useState<DraftIdea[]>([])
  const [existingTitleSet, setExistingTitleSet] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittingIdeaId, setSubmittingIdeaId] = useState<string | null>(null)
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const [selectedPromptTitle, setSelectedPromptTitle] = useState<string | null>(null)

  const normalizeTitle = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ')

  const recomputeDuplicates = (ideas: DraftIdea[], existingTitles: Set<string>) => {
    const seen = new Set(existingTitles)
    return ideas.map((idea) => {
      const normalized = normalizeTitle(idea.title)
      const isDuplicate = normalized.length > 0 && seen.has(normalized)
      if (!isDuplicate && normalized.length > 0) {
        seen.add(normalized)
      }
      return {
        ...idea,
        isDuplicate,
        selected: isDuplicate ? false : idea.selected,
      }
    })
  }

  const handleCategorySelect = (category: IdeaCategory) => {
    setSelectedCategory(category)
    setViewMode('prompts')
  }

  const handlePromptSelect = async (promptId: string) => {
    if (!selectedCategory) return
    
    setIsGenerating(true)
    setViewMode('generating')
    setError(null)
    setGeneratedCount(0)

    try {
      const promptTitle = PROMPTS[selectedCategory]?.find((prompt) => prompt.id === promptId)?.title ?? null
      setSelectedPromptTitle(promptTitle)
      const result = await api.generateIdeas(projectName, selectedCategory, promptId, 10, true)
      if (!result.success) {
        throw new Error('Failed to generate ideas')
      }

      const existingIdeas = await api.getIdeas(projectName).catch(() => [])
      const existingTitles = new Set(
        existingIdeas
          .filter((idea) => !idea.promoted)
          .map((idea) => normalizeTitle(idea.title))
      )

      const drafts: DraftIdea[] = result.ideas.map((idea: Idea) => ({
        ...idea,
        selected: true,
        isDuplicate: false,
      }))

      const normalizedDrafts = recomputeDuplicates(drafts, existingTitles)
      setExistingTitleSet(existingTitles)
      setDraftIdeas(normalizedDrafts)
      setGeneratedCount(normalizedDrafts.length)
      setIsGenerating(false)
      setViewMode('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate ideas')
      setIsGenerating(false)
      setViewMode('prompts')
    }
  }

  const handleBack = () => {
    setViewMode('categories')
    setSelectedCategory(null)
    setError(null)
  }

  const handleBackToPrompts = () => {
    setViewMode('prompts')
    setError(null)
  }

  const handleDiscardAll = () => {
    setDraftIdeas([])
    setGeneratedCount(0)
    setSelectedCategory(null)
    setViewMode('categories')
    setError(null)
  }

  const handleSelectAllNonDuplicates = () => {
    const updated = draftIdeas.map((idea) => ({
      ...idea,
      selected: !idea.isDuplicate,
    }))
    setDraftIdeas(updated)
  }

  const handleClearSelection = () => {
    const updated = draftIdeas.map((idea) => ({
      ...idea,
      selected: false,
    }))
    setDraftIdeas(updated)
  }

  const handleRemoveDraft = (ideaId: string) => {
    const updated = recomputeDuplicates(
      draftIdeas.filter((idea) => idea.id !== ideaId),
      existingTitleSet
    )
    setDraftIdeas(updated)
  }

  const handleDraftFieldChange = (
    ideaId: string,
    field: 'title' | 'description' | 'rationale' | 'priority' | 'selected',
    value: string | boolean | IdeaPriority
  ) => {
    const updated = draftIdeas.map((idea) => {
      if (idea.id !== ideaId) return idea
      return {
        ...idea,
        [field]: value,
      }
    })
    setDraftIdeas(recomputeDuplicates(updated, existingTitleSet))
  }

  const handleAddSelected = async () => {
    const selectedIdeas = draftIdeas.filter((idea) => idea.selected && !idea.isDuplicate)
    if (selectedIdeas.length === 0) {
      setError('Select at least one idea to add to backlog.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await Promise.all(
        selectedIdeas.map((idea) =>
          api.createIdea(projectName, {
            category: idea.category,
            title: idea.title.trim(),
            description: idea.description.trim(),
            rationale: idea.rationale.trim(),
            priority: idea.priority,
          })
        )
      )
      setDraftIdeas([])
      setGeneratedCount(0)
      setSelectedPromptTitle(null)
      setSelectedPromptTitle(null)
      setSelectedCategory(null)
      setViewMode('categories')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add ideas to backlog')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCategoryInfo = CATEGORIES.find(c => c.id === selectedCategory)
  const selectedCount = draftIdeas.filter((idea) => idea.selected && !idea.isDuplicate).length
  const duplicateCount = draftIdeas.filter((idea) => idea.isDuplicate).length

  const toggleEditing = (ideaId: string) => {
    const next = new Set(editingIds)
    if (next.has(ideaId)) {
      next.delete(ideaId)
    } else {
      next.add(ideaId)
    }
    setEditingIds(next)
  }

  const handleAcceptIdea = async (ideaId: string) => {
    const idea = draftIdeas.find((item) => item.id === ideaId)
    if (!idea || idea.isDuplicate) return

    setSubmittingIdeaId(ideaId)
    setError(null)
    try {
      await api.createIdea(projectName, {
        category: idea.category,
        title: idea.title.trim(),
        description: idea.description.trim(),
        rationale: idea.rationale.trim(),
        priority: idea.priority,
      })
      const updated = recomputeDuplicates(
        draftIdeas.filter((item) => item.id !== ideaId),
        existingTitleSet
      )
      setDraftIdeas(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add idea to backlog')
    } finally {
      setSubmittingIdeaId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Categories View */}
      {viewMode === 'categories' && (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Select a category to generate AI-powered ideas for your project.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className="
                  neo-card p-3 text-left
                  hover:shadow-[var(--shadow-neo-md)]
                  hover:-translate-y-0.5
                  transition-all duration-150
                  group
                "
              >
                <div className="flex items-start gap-2">
                  <div className="
                    p-1.5 rounded-md
                    bg-[var(--color-bg-tertiary)]
                    text-[var(--color-text-secondary)]
                    group-hover:text-[var(--color-accent-primary)]
                    transition-colors
                  ">
                    {category.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{category.name}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                      {category.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompts View */}
      {viewMode === 'prompts' && selectedCategory && (
        <div className="flex-1 overflow-y-auto">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="
              flex items-center gap-2 px-4 py-3 w-full
              text-[var(--color-text-secondary)]
              hover:bg-[var(--color-bg-tertiary)]
              border-b border-[var(--color-border-subtle)]
            "
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Back to categories</span>
          </button>

          {/* Category header */}
          <div className="px-4 py-3 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2">
              {selectedCategoryInfo?.icon}
              <span className="font-bold">{selectedCategoryInfo?.name}</span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Select a prompt to generate ideas
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-[var(--color-status-error)]/10 border-2 border-[var(--color-status-error)] rounded-lg">
              <p className="text-sm text-[var(--color-status-error)]">{error}</p>
            </div>
          )}

          {/* Prompts list */}
          <div className="p-4 space-y-2">
            {PROMPTS[selectedCategory]?.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handlePromptSelect(prompt.id)}
                disabled={isGenerating}
                className="
                  w-full neo-card p-3 text-left
                  hover:shadow-[var(--shadow-neo-md)]
                  hover:-translate-y-0.5
                  transition-all duration-150
                  flex items-center justify-between gap-3
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <div>
                  <h4 className="font-bold text-sm">{prompt.title}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {prompt.description}
                  </p>
                </div>
                <ChevronRight size={16} className="text-[var(--color-text-secondary)] flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review View */}
      {viewMode === 'review' && selectedCategory && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Review header */}
          <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] bg-gradient-to-r from-[rgba(255,0,110,0.12)] via-[rgba(131,56,236,0.08)] to-[rgba(58,134,255,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {selectedCategoryInfo?.icon}
                  <span className="font-display font-bold text-base">Review ideas</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border-2 border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
                    {generatedCount} generated
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Approve the best ideas before they go to backlog.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllNonDuplicates}
                  className="neo-btn neo-btn-ghost text-xs"
                >
                  Select all
                </button>
                <button
                  onClick={handleClearSelection}
                  className="neo-btn neo-btn-ghost text-xs"
                >
                  Clear
                </button>
                <button
                  onClick={handleBackToPrompts}
                  className="neo-btn neo-btn-ghost text-xs"
                >
                  Back to prompts
                </button>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-[var(--color-status-error)]/10 border-2 border-[var(--color-status-error)] rounded-lg">
              <p className="text-sm text-[var(--color-status-error)]">{error}</p>
            </div>
          )}

          {/* Selection bar */}
          <div className="px-5 py-2 border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-3 bg-[var(--color-bg-secondary)]">
            <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
              <span>{selectedCount} selected</span>
              <span>•</span>
              <span>{duplicateCount} duplicates blocked</span>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              Category: <span className="font-semibold">{selectedCategoryInfo?.name}</span>
              {selectedPromptTitle && (
                <span> • Prompt: <span className="font-semibold">{selectedPromptTitle}</span></span>
              )}
            </div>
          </div>

          {/* Draft ideas list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {draftIdeas.length === 0 ? (
              <div className="text-sm text-[var(--color-text-secondary)]">
                No ideas to review.
              </div>
            ) : (
              draftIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="neo-card p-4 bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] shadow-[var(--shadow-neo-sm)] rounded-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{idea.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border-2 border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
                          {idea.priority}
                        </span>
                        {selectedPromptTitle && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border-2 border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
                            {selectedPromptTitle}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {idea.description}
                      </p>
                      {idea.rationale && (
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-2 italic">
                          {idea.rationale}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleRemoveDraft(idea.id)}
                        className="neo-btn neo-btn-ghost p-1.5"
                        title="Remove idea"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => handleAcceptIdea(idea.id)}
                        className="neo-btn neo-btn-primary text-xs"
                        disabled={idea.isDuplicate || submittingIdeaId === idea.id}
                      >
                        {submittingIdeaId === idea.id ? 'Adding…' : 'Accept'}
                      </button>
                      {idea.isDuplicate && (
                        <span className="text-[10px] text-[var(--color-status-error)] flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Duplicate
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <input
                        type="checkbox"
                        className="accent-[var(--color-accent-primary)]"
                        checked={idea.selected}
                        disabled={idea.isDuplicate}
                        onChange={(e) => handleDraftFieldChange(idea.id, 'selected', e.target.checked)}
                      />
                      Include in bulk add
                    </label>
                    <button
                      onClick={() => toggleEditing(idea.id)}
                      className="neo-btn neo-btn-ghost text-xs"
                    >
                      {editingIds.has(idea.id) ? 'Close edit' : 'Edit'}
                    </button>
                  </div>

                  {editingIds.has(idea.id) && (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold mb-1">Title</label>
                        <input
                          type="text"
                          className="neo-input w-full"
                          value={idea.title}
                          onChange={(e) => handleDraftFieldChange(idea.id, 'title', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold mb-1">Description</label>
                        <textarea
                          className="neo-input w-full h-20 resize-none"
                          value={idea.description}
                          onChange={(e) => handleDraftFieldChange(idea.id, 'description', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold mb-1">Rationale</label>
                        <textarea
                          className="neo-input w-full h-16 resize-none"
                          value={idea.rationale}
                          onChange={(e) => handleDraftFieldChange(idea.id, 'rationale', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold">Priority</label>
                        <select
                          className="neo-input text-xs"
                          value={idea.priority}
                          onChange={(e) => handleDraftFieldChange(idea.id, 'priority', e.target.value as IdeaPriority)}
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Review footer */}
          <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)] flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {selectedCount} selected of {draftIdeas.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscardAll}
                className="neo-btn neo-btn-ghost text-xs"
                disabled={isSubmitting}
              >
                Discard
              </button>
              <button
                onClick={handleAddSelected}
                className="neo-btn neo-btn-primary text-xs"
                disabled={isSubmitting || selectedCount === 0}
              >
                {isSubmitting ? 'Adding...' : 'Add selected to backlog'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generating View */}
      {viewMode === 'generating' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {generatedCount === 0 ? (
            <>
              <div className="relative">
                <Loader2 size={48} className="animate-spin text-[var(--color-accent-primary)]" />
                <Sparkles 
                  size={24} 
                  className="absolute -top-1 -right-1 text-[var(--color-status-pending)] animate-pulse" 
                />
              </div>
              <h3 className="font-display font-bold text-lg mt-4">Generating Ideas...</h3>
              <p className="text-sm text-[var(--color-text-secondary)] text-center mt-2">
                AI is analyzing your project and generating creative ideas
              </p>
            </>
          ) : (
            <>
              <div className="
                w-16 h-16 rounded-full
                bg-[var(--color-status-done)] 
                flex items-center justify-center
                animate-bounce
              ">
                <Sparkles size={32} className="text-white" />
              </div>
              <h3 className="font-display font-bold text-lg mt-4">
                {generatedCount} Ideas Generated!
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] text-center mt-2">
                Your ideas are ready for review
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
