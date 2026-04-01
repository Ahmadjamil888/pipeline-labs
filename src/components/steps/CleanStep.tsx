import { usePipeline } from '@/context/PipelineContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ColumnType } from '@/types/dataset';

const typeColors: Record<ColumnType, string> = {
  numerical: 'bg-info/20 text-info',
  categorical: 'bg-warning/20 text-warning',
  text: 'bg-primary/20 text-primary',
  datetime: 'bg-accent/20 text-accent',
  irrelevant: 'bg-destructive/20 text-destructive',
};

export function CleanStep() {
  const { dataset, updateColumn, runCleaning } = usePipeline();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Column Configuration</h2>
          <p className="text-sm text-muted-foreground">Toggle columns, choose scaling, review types</p>
        </div>
        <Button onClick={runCleaning}>Apply Cleaning</Button>
      </div>

      <div className="grid gap-3">
        {dataset.columns.map(col => (
          <div
            key={col.name}
            className={`flex items-center gap-4 rounded-lg border p-4 transition-all ${
              col.keep ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'
            }`}
          >
            <Switch checked={col.keep} onCheckedChange={v => updateColumn(col.name, { keep: v })} />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-foreground">{col.name}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeColors[col.type]}`}>{col.type}</span>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                <span>Nulls: {col.nullPercent.toFixed(1)}%</span>
                <span>Unique: {col.uniqueCount}</span>
                {col.type === 'numerical' && col.mean !== undefined && (
                  <span>Mean: {col.mean.toFixed(2)}</span>
                )}
                {col.type === 'categorical' && col.mode && (
                  <span>Mode: {col.mode}</span>
                )}
              </div>
            </div>

            {col.type === 'numerical' && col.keep && (
              <Select value={col.scalingMethod} onValueChange={v => updateColumn(col.name, { scalingMethod: v as 'none' | 'normalize' | 'standardize' })}>
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
    </div>
  );
}
