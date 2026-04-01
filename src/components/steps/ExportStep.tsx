import { usePipeline } from '@/context/PipelineContext';
import { Button } from '@/components/ui/button';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportCSV, exportJSON } from '@/lib/dataProcessing';

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

  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Export Ready</h2>
        <p className="mt-2 text-muted-foreground">
          {dataset.transformedData.length} rows × {dataset.transformedData[0] ? Object.keys(dataset.transformedData[0]).length : 0} features
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => downloadFile(exportCSV(dataset.transformedData), `${baseName}_ml_ready.csv`, 'text/csv')}
          className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 transition-all hover:border-primary hover:glow-primary"
        >
          <div className="rounded-full bg-info/10 p-4">
            <FileSpreadsheet className="h-8 w-8 text-info" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">ML-Ready CSV</p>
            <p className="text-sm text-muted-foreground">Cleaned, encoded, scaled</p>
          </div>
        </button>

        <button
          onClick={() => downloadFile(exportJSON(dataset.llmReadyData), `${baseName}_llm_ready.json`, 'application/json')}
          className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 transition-all hover:border-primary hover:glow-primary"
        >
          <div className="rounded-full bg-primary/10 p-4">
            <FileJson className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">LLM-Ready JSON</p>
            <p className="text-sm text-muted-foreground">Structured features + metadata</p>
          </div>
        </button>
      </div>

      {dataset.llmReadyData[0] && (
        <div className="w-full max-w-2xl">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Sample LLM-Ready Output:</h3>
          <pre className="overflow-auto rounded-lg bg-muted p-4 font-mono text-xs text-foreground">
            {JSON.stringify(dataset.llmReadyData[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
