import { usePipeline } from '@/context/PipelineContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

export function AnalyzeStep() {
  const { dataset, runAnalysis, isProcessing } = usePipeline();
  const preview = dataset.rawData.slice(0, 20);
  const columns = preview.length ? Object.keys(preview[0]) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Data Preview</h2>
          <p className="text-sm text-muted-foreground">{dataset.rawData.length} rows × {columns.length} columns</p>
        </div>
        <Button onClick={runAnalysis} disabled={isProcessing}>
          {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : 'Run Analysis'}
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map(col => (
                <TableHead key={col} className="whitespace-nowrap font-mono text-xs">{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/30">
                {columns.map(col => (
                  <TableCell key={col} className="max-w-[200px] truncate font-mono text-xs">
                    {String(row[col] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
