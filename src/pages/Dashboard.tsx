import { useNavigate } from 'react-router-dom';
import { PipelineProvider, usePipeline } from '@/context/PipelineContext';
import { PipelineStepper } from '@/components/PipelineStepper';
import { UploadStep } from '@/components/steps/UploadStep';
import { AnalyzeStep } from '@/components/steps/AnalyzeStep';
import { CleanStep } from '@/components/steps/CleanStep';
import { TransformStep } from '@/components/steps/TransformStep';
import { ExportStep } from '@/components/steps/ExportStep';
import { AIReasoningPanel } from '@/components/AIReasoningPanel';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import logoDark from '@/assets/logo-dark.png';
import { LogOut } from 'lucide-react';

function PipelineContent() {
  const { step, dataset } = usePipeline();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const showAI = dataset.aiReasonings.length > 0 && ['clean', 'transform', 'export'].includes(step);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background dark">
      <header className="border-b border-border bg-card/50">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img src={logoDark} alt="Logo" className="h-7 w-7 invert dark:invert-0" />
            <h1 className="text-base font-bold tracking-tight text-foreground">Pipeline Labs</h1>
          </div>
          <PipelineStepper />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

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

export default function Dashboard() {
  return (
    <PipelineProvider>
      <PipelineContent />
    </PipelineProvider>
  );
}
