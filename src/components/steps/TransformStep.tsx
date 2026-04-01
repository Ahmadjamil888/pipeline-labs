import { usePipeline } from '@/context/PipelineContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function TransformStep() {
  const { dataset, runTransform } = usePipeline();
  const preview = dataset.cleanedData.slice(0, 10);
  const columns = preview.length ? Object.keys(preview[0]) : [];
  const keptCols = dataset.columns.filter(c => c.keep);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Transform Preview</h2>
          <p className="text-sm text-muted-foreground">
            {dataset.cleanedData.length} rows after cleaning • {keptCols.length} columns kept
          </p>
        </div>
        <Button onClick={runTransform}>Run Transformation</Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Transformations to apply:</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {keptCols.map(col => (
            <div key={col.name} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="font-mono text-foreground">{col.name}</span>
              <span className="ml-2 text-muted-foreground">
                {col.type === 'categorical' && '→ one-hot'}
                {col.type === 'datetime' && '→ year/month/day'}
                {col.type === 'numerical' && col.scalingMethod !== 'none' && `→ ${col.scalingMethod}`}
                {col.type === 'numerical' && col.scalingMethod === 'none' && '→ as-is'}
                {col.type === 'text' && '→ keep raw'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {preview.length > 0 && (
        <div className="overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.slice(0, 10).map(col => (
                  <TableHead key={col} className="whitespace-nowrap font-mono text-xs">{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row, i) => (
                <TableRow key={i}>
                  {columns.slice(0, 10).map(col => (
                    <TableCell key={col} className="font-mono text-xs">{String(row[col] ?? '')}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
