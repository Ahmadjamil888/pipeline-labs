import { usePipeline } from '@/context/PipelineContext';
import { Brain, AlertTriangle, Lightbulb, Trash2, Check, ArrowRightLeft } from 'lucide-react';
import type { AIReasoning } from '@/types/dataset';
import { motion } from 'framer-motion';

const typeIcons: Record<AIReasoning['type'], React.ElementType> = {
  drop: Trash2,
  keep: Check,
  transform: ArrowRightLeft,
  warning: AlertTriangle,
  suggestion: Lightbulb,
};

export function AIReasoningPanel() {
  const { dataset } = usePipeline();
  const { aiReasonings } = dataset;

  if (!aiReasonings.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="border border-border bg-card p-4"
    >
      <div className="mb-4 flex items-center gap-2">
        <Brain className="h-5 w-5 text-foreground" />
        <h3 className="font-bold text-foreground">AI Reasoning</h3>
      </div>
      <div className="space-y-2 max-h-[70vh] overflow-auto">
        {aiReasonings.map((r, i) => {
          const Icon = typeIcons[r.type] || Lightbulb;
          return (
            <div key={i} className="border border-border p-3">
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">{r.column}</span>
                    <span className="text-xs text-muted-foreground">— {r.action}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                  {r.suggestion && (
                    <p className="mt-1 text-xs text-muted-foreground">→ {r.suggestion}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
