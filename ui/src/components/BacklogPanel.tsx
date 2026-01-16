/**
 * Backlog Panel Component
 * 
 * Kanban-style board showing ideas organized by category.
 * Ideas can be added manually or from AI generation.
 * Ideas can be promoted to features on the main Kanban board.
 */

import { useState, useCallback } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { 
  Plus, Zap, Palette, Code, TrendingUp, Cpu, Shield, 
  Gauge, Accessibility, BarChart3, Trash2, ArrowUpRight,
  X, ChevronDown, ChevronUp
} from 'lucide-react'
import * as api from '../lib/api'
import type { Idea, IdeaCategory, IdeaPriority } from '../lib/types'

interface BacklogPanelProps {
  projectName: string
}

// Category icons mapping
const CATEGORY_ICONS: Record<IdeaCategory, React.ReactNode> = {
  feature: <Zap size={14} />,
  'ux-ui': <Palette size={14} />,
  dx: <Code size={14} />,
  growth: <TrendingUp size={14} />,
  technical: <Cpu size={14} />,
  security: <Shield size={14} />,
  performance: <Gauge size={14} />,
  accessibility: <Accessibility size={14} />,
  analytics: <BarChart3 size={14} />,
}

const CATEGORY_NAMES: Record<IdeaCategory, string> = {
  feature: 'Features',
  'ux-ui': 'UX/UI',
  dx: 'Dev Exp',
  growth: 'Growth',
  technical: 'Technical',
  security: 'Security',
  performance: 'Performance',
  accessibility: 'Accessibility',
  analytics: 'Analytics',
}

const PRIORITY_COLORS: Record<IdeaPriority, string> = {
  high: 'var(--color-status-error)',
  medium: 'var(--color-status-pending)',
  low: 'var(--color-status-done)',
}

const ALL_CATEGORIES: IdeaCategory[] = [
  'feature', 'ux-ui', 'dx', 'growth', 'technical', 
  'security', 'performance', 'accessibility', 'analytics'
]

interface AddIdeaModalProps {
  category: IdeaCategory
  projectName: string
  onClose: () => void
  onSuccess: () => void
}

function AddIdeaModal({ category, projectName, onClose, onSuccess }: AddIdeaModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rationale, setRationale] = useState('')
  const [priority, setPriority] = useState<IdeaPriority>('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    try {
      await api.createIdea(projectName, {
        category,
        title: title.trim(),
        description: description.trim(),
        rationale: rationale.trim(),
        priority,
      })
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to create idea:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="
        relative bg-[var(--color-bg-secondary)] 
        border-3 border-[var(--color-border-default)]
        shadow-[var(--shadow-neo-lg)]
        rounded-lg w-full max-w-md
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--color-border-default)]">
          <h3 className="font-display font-bold flex items-center gap-2">
            {CATEGORY_ICONS[category]}
            Add Idea to {CATEGORY_NAMES[category]}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="neo-input w-full"
              placeholder="Short, actionable title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="neo-input w-full h-20 resize-none"
              placeholder="What needs to be built or improved?"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Rationale</label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="neo-input w-full h-16 resize-none"
              placeholder="Why is this valuable?"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Priority</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as IdeaPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`
                    px-3 py-1.5 rounded-md border-2 text-sm font-bold capitalize
                    transition-all duration-150
                    ${priority === p 
                      ? 'border-[var(--color-border-default)] shadow-[var(--shadow-neo-sm)]' 
                      : 'border-transparent'
                    }
                  `}
                  style={{ 
                    backgroundColor: priority === p ? PRIORITY_COLORS[p] : 'var(--color-bg-tertiary)',
                    color: priority === p ? 'white' : 'var(--color-text-secondary)'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="neo-btn">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !title.trim()}
              className="neo-btn neo-btn-primary"
            >
              {isSubmitting ? 'Adding...' : 'Add Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface IdeaCardProps {
  idea: Idea
  projectName: string
  onDelete: () => void
  onPromote: () => void
}

function IdeaCard({ idea, projectName, onDelete, onPromote }: IdeaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPromoting, setIsPromoting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await api.deleteIdea(projectName, idea.id)
      onDelete()
    } catch (err) {
      console.error('Failed to delete idea:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePromote = async () => {
    setIsPromoting(true)
    try {
      await api.promoteIdea(projectName, idea.id)
      onPromote()
    } catch (err) {
      console.error('Failed to promote idea:', err)
    } finally {
      setIsPromoting(false)
    }
  }

  return (
    <div className="
      bg-[var(--color-bg-elevated)] 
      border-2 border-[var(--color-border-default)]
      rounded-lg shadow-[var(--shadow-neo-sm)]
      overflow-hidden
    ">
      {/* Card header */}
      <div className="p-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-sm line-clamp-2">{idea.title}</h4>
          <span 
            className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0"
            style={{ 
              backgroundColor: PRIORITY_COLORS[idea.priority],
              color: 'white'
            }}
          >
            {idea.priority}
          </span>
        </div>

        {idea.description && (
          <p className={`text-xs text-[var(--color-text-secondary)] mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {idea.description}
          </p>
        )}

        {(idea.description?.length ?? 0) > 80 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-[var(--color-accent-tertiary)] flex items-center gap-0.5 mt-1"
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {isExpanded ? 'Less' : 'More'}
          </button>
        )}
      </div>

      {/* Card actions */}
      <div className="flex border-t border-[var(--color-border-subtle)]">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="
            flex-1 py-1.5 text-xs font-bold
            flex items-center justify-center gap-1
            hover:bg-[var(--color-status-error)]/10
            text-[var(--color-text-secondary)]
            hover:text-[var(--color-status-error)]
            transition-colors
            disabled:opacity-50
          "
          title="Delete idea"
        >
          <Trash2 size={12} />
        </button>
        <div className="w-px bg-[var(--color-border-subtle)]" />
        <button
          onClick={handlePromote}
          disabled={isPromoting}
          className="
            flex-1 py-1.5 text-xs font-bold
            flex items-center justify-center gap-1
            hover:bg-[var(--color-status-done)]/10
            text-[var(--color-text-secondary)]
            hover:text-[var(--color-status-done)]
            transition-colors
            disabled:opacity-50
          "
          title="Promote to feature"
        >
          <ArrowUpRight size={12} />
          Promote
        </button>
      </div>
    </div>
  )
}

export function BacklogPanel({ projectName }: BacklogPanelProps) {
  const [addingToCategory, setAddingToCategory] = useState<IdeaCategory | null>(null)
  const queryClient = useQueryClient()

  // Fetch ideas
  const { data: ideas = [], isLoading, refetch } = useQuery({
    queryKey: ['ideas', projectName],
    queryFn: () => api.getIdeas(projectName),
    refetchInterval: 5000, // Poll for new ideas from AI generation
  })

  const handleRefresh = useCallback(() => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ['features', projectName] })
  }, [refetch, queryClient, projectName])

  // Group ideas by category
  const ideasByCategory = ALL_CATEGORIES.reduce((acc, category) => {
    acc[category] = ideas.filter(idea => idea.category === category && !idea.promoted)
    return acc
  }, {} as Record<IdeaCategory, Idea[]>)

  const totalIdeas = ideas.filter(i => !i.promoted).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats bar */}
      <div className="px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)]">
        <p className="text-xs text-[var(--color-text-secondary)]">
          {totalIdeas} idea{totalIdeas !== 1 ? 's' : ''} in backlog
        </p>
      </div>

      {/* Scrollable category columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max">
          {ALL_CATEGORIES.map((category) => {
            const categoryIdeas = ideasByCategory[category]
            return (
              <div 
                key={category}
                className="
                  w-48 flex-shrink-0 h-full
                  flex flex-col
                  border-r border-[var(--color-border-subtle)]
                  last:border-r-0
                "
              >
                {/* Column header */}
                <div className="
                  px-3 py-2 
                  bg-[var(--color-bg-tertiary)]
                  border-b border-[var(--color-border-subtle)]
                  flex items-center justify-between
                ">
                  <div className="flex items-center gap-1.5">
                    {CATEGORY_ICONS[category]}
                    <span className="font-bold text-xs">{CATEGORY_NAMES[category]}</span>
                    {categoryIdeas.length > 0 && (
                      <span className="
                        text-[10px] px-1.5 py-0.5 
                        bg-[var(--color-bg-elevated)] 
                        rounded-full font-mono
                      ">
                        {categoryIdeas.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setAddingToCategory(category)}
                    className="
                      p-1 rounded
                      hover:bg-[var(--color-bg-elevated)]
                      text-[var(--color-text-secondary)]
                      hover:text-[var(--color-accent-primary)]
                      transition-colors
                    "
                    title={`Add idea to ${CATEGORY_NAMES[category]}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Column content */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {isLoading ? (
                    <div className="text-center py-4 text-xs text-[var(--color-text-secondary)]">
                      Loading...
                    </div>
                  ) : categoryIdeas.length === 0 ? (
                    <div className="
                      text-center py-4 
                      text-xs text-[var(--color-text-tertiary)]
                      border-2 border-dashed border-[var(--color-border-subtle)]
                      rounded-lg
                    ">
                      No ideas yet
                    </div>
                  ) : (
                    categoryIdeas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        projectName={projectName}
                        onDelete={handleRefresh}
                        onPromote={handleRefresh}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Idea Modal */}
      {addingToCategory && (
        <AddIdeaModal
          category={addingToCategory}
          projectName={projectName}
          onClose={() => setAddingToCategory(null)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  )
}
