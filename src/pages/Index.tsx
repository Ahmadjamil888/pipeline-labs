import { PipelineProvider, usePipeline } from '@/context/PipelineContext';
import { PipelineStepper } from '@/components/PipelineStepper';
import { UploadStep } from '@/components/steps/UploadStep';
import { AnalyzeStep } from '@/components/steps/AnalyzeStep';
import { CleanStep } from '@/components/steps/CleanStep';
import { TransformStep } from '@/components/steps/TransformStep';
import { ExportStep } from '@/components/steps/ExportStep';
import { AIReasoningPanel } from '@/components/AIReasoningPanel';
import logoDark from '@/assets/logo-dark.png';

function PipelineContent() {
  const { step, dataset } = usePipeline();
  const showAI = dataset.aiReasonings.length > 0 && ['clean', 'transform', 'export'].includes(step);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img src={logoDark} alt="Logo" className="h-8 w-8" />
            <h1 className="text-lg font-bold text-foreground">DataForge</h1>
          </div>
          <PipelineStepper />
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className={showAI ? 'grid gap-6 lg:grid-cols-[1fr_340px]' : ''}>
          <div>
            {step === 'upload' && <UploadStep />}
            {step === 'analyze' && <AnalyzeStep />}
            {step === 'clean' && <CleanStep />}
            {step === 'transform' && <TransformStep />}
            {step === 'export' && <ExportStep />}
          </div>
          {showAI && (
            <aside className="hidden lg:block">
              <AIReasoningPanel />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

const Index = () => (
  <PipelineProvider>
    <PipelineContent />
  </PipelineProvider>
);

export default Index;
