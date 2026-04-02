import { usePipeline } from '@/context/PipelineContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export function AnalyzeStep() {
  const { dataset, runAnalysis, isProcessing } = usePipeline();
  const preview = dataset.rawData.slice(0, 20);
  const columns = preview.length ? Object.keys(preview[0]) : [];
  const hasAnalysis = dataset.columns.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Data Preview</h2>
          <p className="text-sm text-muted-foreground">{dataset.rawData.length} rows × {columns.length} columns</p>
        </div>
        <Button onClick={runAnalysis} disabled={isProcessing}>
          {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : 'Run Analysis'}
        </Button>
      </div>

      {/* Warnings for detected identifiers/emails */}
      {hasAnalysis && dataset.columns.filter(c => c.warning).length > 0 && (
        <div className="space-y-2">
          {dataset.columns.filter(c => c.warning).map(col => (
            <div key={col.name} className="flex items-start gap-2 border border-border bg-card p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <span className="font-mono font-medium text-foreground">{col.name}</span>
                <span className="ml-2 text-muted-foreground">{col.warning}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Advanced Stats Summary */}
      {hasAnalysis && (
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {dataset.columns.filter(c => c.type === 'numerical').slice(0, 6).map(col => (
            <div key={col.name} className="bg-background p-4">
              <p className="mb-2 font-mono text-sm font-medium text-foreground">{col.name}</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Mean: {col.mean?.toFixed(2)}</span>
                <span>Std: {col.std?.toFixed(2)}</span>
                <span>Min: {col.min?.toFixed(2)}</span>
                <span>Max: {col.max?.toFixed(2)}</span>
                <span>Q1: {col.q1?.toFixed(2)}</span>
                <span>Q3: {col.q3?.toFixed(2)}</span>
                {col.skewness !== undefined && <span>Skew: {col.skewness.toFixed(3)}</span>}
                {col.kurtosis !== undefined && <span>Kurt: {col.kurtosis.toFixed(3)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-card">
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
    </motion.div>
  );
}
