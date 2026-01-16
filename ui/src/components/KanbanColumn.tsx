import { FeatureCard } from './FeatureCard'
import type { Feature } from '../lib/types'

interface KanbanColumnProps {
  title: string
  count: number
  features: Feature[]
  color: 'pending' | 'progress' | 'done' | 'skipped'
  onFeatureClick: (feature: Feature) => void
}

const colorMap = {
  pending: 'var(--color-neo-pending)',
  progress: 'var(--color-neo-progress)',
  done: 'var(--color-neo-done)',
  skipped: 'var(--color-neo-skipped)',
}

export function KanbanColumn({
  title,
  count,
  features,
  color,
  onFeatureClick,
}: KanbanColumnProps) {
  return (
    <div
      className="neo-card overflow-hidden"
      style={{ borderColor: colorMap[color], borderWidth: '2px' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b-2"
        style={{ 
          backgroundColor: colorMap[color],
          borderColor: colorMap[color]
        }}
      >
        <h2 className="font-display text-lg font-bold uppercase flex items-center justify-between text-[#1a1a1a]">
          {title}
          <span className="neo-badge bg-white/90 text-[#1a1a1a] border-0">{count}</span>
        </h2>
      </div>

      {/* Cards */}
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto bg-[var(--color-bg-primary)]">
        {features.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">
            No features
          </div>
        ) : (
          features.map((feature, index) => (
            <div
              key={feature.id}
              className="animate-slide-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <FeatureCard
                feature={feature}
                onClick={() => onFeatureClick(feature)}
                isInProgress={color === 'progress'}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
