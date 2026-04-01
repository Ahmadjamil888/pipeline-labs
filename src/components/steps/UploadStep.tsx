import { useCallback, useState } from 'react';
import { usePipeline } from '@/context/PipelineContext';
import { Upload, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UploadStep() {
  const { handleUpload, isProcessing } = usePipeline();
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-6 rounded-xl border-2 border-dashed p-16 transition-all ${
          dragOver ? 'border-primary bg-primary/5 glow-primary' : 'border-border hover:border-muted-foreground'
        }`}
      >
        <div className="rounded-full bg-secondary p-6">
          <Upload className="h-10 w-10 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Drop your dataset here</h2>
          <p className="mt-2 text-muted-foreground">or click to browse — supports CSV and JSON</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground">
            <FileJson className="h-4 w-4" /> JSON
          </div>
        </div>
        <label>
          <Button variant="outline" disabled={isProcessing} asChild>
            <span className="cursor-pointer">
              {isProcessing ? 'Processing...' : 'Choose File'}
            </span>
          </Button>
          <input type="file" accept=".csv,.json" className="hidden" onChange={onFileSelect} />
        </label>
      </div>
    </div>
  );
}
