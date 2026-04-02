import { useEffect } from "react";

export default function ApiDocs() {
  useEffect(() => {
    // Redirect to external API documentation
    window.location.href = "https://docs.pipelinelabs.ai";
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to API documentation...</p>
      </div>
    </div>
  );
}
