import DistilleryTimelineInfographic, { type DistilleryMilestone } from './DistilleryTimelineInfographic.tsx';
import ardbegMilestones from './ardbegHistory.json';

type Props = { logoUrl: string | null; milestones?: DistilleryMilestone[] };

export default function ArdbegTimelineInfographic({ logoUrl, milestones = ardbegMilestones }: Props) {
  return (
    <DistilleryTimelineInfographic
      distilleryName="Ardbeg"
      logoUrl={logoUrl}
      milestones={milestones}
      showArdbegSources
    />
  );
}
