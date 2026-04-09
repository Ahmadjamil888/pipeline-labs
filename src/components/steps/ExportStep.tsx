import { usePipeline } from '@/context/PipelineContext';
import { Button } from '@/components/ui/button';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportCSV, exportJSON } from '@/lib/dataProcessing';
import { motion } from 'framer-motion';

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportStep() {
  const { dataset, fileName } = usePipeline();
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const data = dataset.currentData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-8 py-12"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Export Ready</h2>
        <p className="mt-2 text-muted-foreground">
          {data.length} rows × {data[0] ? Object.keys(data[0]).length : 0} features
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => downloadFile(exportCSV(data), `${baseName}_ml_ready.csv`, 'text/csv')}
          className="flex flex-col items-center gap-4 border border-border bg-background p-8 transition-all hover:bg-muted"
        >
          <FileSpreadsheet className="h-8 w-8 text-foreground" />
          <div className="text-center">
            <p className="font-bold text-foreground">ML-Ready CSV</p>
            <p className="text-sm text-muted-foreground">Cleaned, encoded, scaled</p>
          </div>
        </button>

        <button
          onClick={() => downloadFile(exportJSON(data), `${baseName}_llm_ready.json`, 'application/json')}
          className="flex flex-col items-center gap-4 border border-border bg-background p-8 transition-all hover:bg-muted"
        >
          <FileJson className="h-8 w-8 text-foreground" />
          <div className="text-center">
            <p className="font-bold text-foreground">LLM-Ready JSON</p>
            <p className="text-sm text-muted-foreground">Structured features + metadata</p>
          </div>
        </button>
      </div>

      {data[0] && (
        <div className="w-full max-w-2xl">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Sample Output:</h3>
          <pre className="overflow-auto border border-border bg-card p-4 font-mono text-xs text-foreground">
            {JSON.stringify(data[0], null, 2)}
          </pre>
        </div>
      )}
    </motion.div>
  );
}
