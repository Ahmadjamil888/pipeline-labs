import { usePipeline } from '@/context/PipelineContext';
import type { PipelineStep } from '@/types/dataset';
import { Upload, Search, Sparkles, ArrowRightLeft, Download } from 'lucide-react';

const steps: { key: PipelineStep; label: string; icon: React.ElementType }[] = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'analyze', label: 'Analyze', icon: Search },
  { key: 'clean', label: 'Clean', icon: Sparkles },
  { key: 'transform', label: 'Transform', icon: ArrowRightLeft },
  { key: 'export', label: 'Export', icon: Download },
];

const stepOrder: PipelineStep[] = ['upload', 'analyze', 'clean', 'transform', 'export'];

export function PipelineStepper() {
  const { step, setStep, dataset } = usePipeline();
  const currentIdx = stepOrder.indexOf(step);

  const canNavigate = (target: PipelineStep) => {
    const targetIdx = stepOrder.indexOf(target);
    if (targetIdx === 0) return true;
    if (targetIdx <= currentIdx) return true;
    return false;
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-card p-1.5">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isActive = step === s.key;
        const isDone = currentIdx > i;
        const clickable = canNavigate(s.key);

        return (
          <button
            key={s.key}
            onClick={() => clickable && setStep(s.key)}
            disabled={!clickable}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? 'bg-primary text-primary-foreground glow-primary'
                : isDone
                ? 'bg-secondary text-foreground hover:bg-secondary/80'
                : 'text-muted-foreground'
            } ${clickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
