import { PIPELINE_STAGES, type StageId, type StageStatus } from '@/lib/derive';

const STATUS_TEXT: Record<StageStatus, string> = {
  idle: 'idle',
  active: 'active',
  done: 'observed',
  failed: 'failed',
};

export function PipelineStages({ status }: { status: Record<StageId, StageStatus> }) {
  return (
    <div className="vf-stages" role="list" aria-label="Target pipeline stages">
      {PIPELINE_STAGES.map((stage) => (
        <div
          key={stage.id}
          role="listitem"
          className="vf-stage"
          data-status={status[stage.id]}
          data-testid={`stage-${stage.id}`}
        >
          <span className="vf-stage__name">{stage.label}</span>
          <span className="vf-stage__caption">{stage.caption}</span>
          <span className="vf-stage__bar" />
          <span className="vf-sr">
            {stage.label}: {STATUS_TEXT[status[stage.id]]}
          </span>
        </div>
      ))}
    </div>
  );
}
