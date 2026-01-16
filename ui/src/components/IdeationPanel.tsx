/**
 * Ideation Panel Component
 * 
 * AI-powered idea generation with category selection and prompt picking.
 * Generated ideas flow into the Backlog panel.
 */

import { useState } from 'react'
import { 
  Zap, Palette, Code, TrendingUp, Cpu, Shield, 
  Gauge, Accessibility, BarChart3, Loader2, Sparkles,
  ChevronRight, ArrowLeft
} from 'lucide-react'
import * as api from '../lib/api'
import type { IdeaCategory, IdeationPrompt } from '../lib/types'

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

type ViewMode = 'categories' | 'prompts' | 'generating'

export function IdeationPanel({ projectName }: IdeationPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('categories')
  const [selectedCategory, setSelectedCategory] = useState<IdeaCategory | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

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
      const result = await api.generateIdeas(projectName, selectedCategory, promptId, 10)
      if (result.success) {
        setGeneratedCount(result.ideas.length)
        // After a brief delay, go back to categories
        setTimeout(() => {
          setViewMode('categories')
          setSelectedCategory(null)
          setIsGenerating(false)
        }, 2000)
      } else {
        throw new Error('Failed to generate ideas')
      }
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

  const selectedCategoryInfo = CATEGORIES.find(c => c.id === selectedCategory)

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
                Check the Backlog panel to review and manage your ideas
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
