import { usePipeline } from '@/context/PipelineContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ColumnType } from '@/types/dataset';

const typeLabels: Record<ColumnType, string> = {
  numerical: 'NUM',
  categorical: 'CAT',
  text: 'TXT',
  datetime: 'DATE',
  irrelevant: 'DROP',
};

export function CleanStep() {
  const { dataset, updateColumn, runCleaning } = usePipeline();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Column Configuration</h2>
          <p className="text-sm text-muted-foreground">Toggle columns, choose scaling, review types</p>
        </div>
        <Button onClick={runCleaning}>Apply Cleaning</Button>
      </div>

      <div className="grid gap-px bg-border">
        {dataset.columns.map(col => (
          <div
            key={col.name}
            className={`flex items-center gap-4 bg-background p-4 ${
              !col.keep ? 'opacity-50' : ''
            }`}
          >
            <Switch checked={col.keep} onCheckedChange={v => updateColumn(col.name, { keep: v })} />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-foreground">{col.name}</span>
                <span className="border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                  {typeLabels[col.type]}
                </span>
                {col.warning && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    {col.isEmail ? 'email' : col.isId ? 'identifier' : 'flagged'}
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                <span>Nulls: {col.nullPercent.toFixed(1)}%</span>
                <span>Unique: {col.uniqueCount}</span>
                {col.type === 'numerical' && col.mean !== undefined && (
                  <span>μ={col.mean.toFixed(2)} σ={col.std?.toFixed(2)}</span>
                )}
                {col.type === 'categorical' && col.mode && (
                  <span>Mode: {col.mode}</span>
                )}
              </div>
            </div>

            {col.type === 'numerical' && col.keep && (
              <Select value={col.scalingMethod} onValueChange={v => updateColumn(col.name, { scalingMethod: v as any })}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No scaling</SelectItem>
                  <SelectItem value="standardize">Standardize</SelectItem>
                  <SelectItem value="normalize">Normalize</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
