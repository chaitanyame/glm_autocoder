import { KanbanColumn } from './KanbanColumn'
import type { Feature, FeatureListResponse } from '../lib/types'

interface KanbanBoardProps {
  features: FeatureListResponse | undefined
  onFeatureClick: (feature: Feature) => void
}

export function KanbanBoard({ features, onFeatureClick }: KanbanBoardProps) {
  if (!features) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {['Pending', 'In Progress', 'Done', 'Skipped'].map(title => (
          <div key={title} className="neo-card p-4">
            <div className="h-8 bg-[var(--color-neo-bg)] animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[var(--color-neo-bg)] animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Check if there are any skipped features
  const skippedFeatures = features.skipped || []
  const hasSkipped = skippedFeatures.length > 0

  return (
    <div className={`grid grid-cols-1 gap-6 ${hasSkipped ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
      <KanbanColumn
        title="Pending"
        count={features.pending.length}
        features={features.pending}
        color="pending"
        onFeatureClick={onFeatureClick}
      />
      <KanbanColumn
        title="In Progress"
        count={features.in_progress.length}
        features={features.in_progress}
        color="progress"
        onFeatureClick={onFeatureClick}
      />
      <KanbanColumn
        title="Done"
        count={features.done.length}
        features={features.done}
        color="done"
        onFeatureClick={onFeatureClick}
      />
      {hasSkipped && (
        <KanbanColumn
          title="Skipped"
          count={skippedFeatures.length}
          features={skippedFeatures}
          color="skipped"
          onFeatureClick={onFeatureClick}
        />
      )}
    </div>
  )
}
