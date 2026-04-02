import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Activity } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  uptime: string;
  responseTime: string;
}

export default function ApiStatus() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "API Gateway", status: "operational", uptime: "99.99%", responseTime: "45ms" },
    { name: "Data Processing", status: "operational", uptime: "99.95%", responseTime: "120ms" },
    { name: "AI Engine", status: "operational", uptime: "99.90%", responseTime: "280ms" },
    { name: "Storage", status: "operational", uptime: "99.99%", responseTime: "25ms" },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate status check
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const getStatusIcon = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "down":
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusText = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded Performance";
      case "down":
        return "Major Outage";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking API status...</p>
        </div>
      </div>
    );
  }

  const allOperational = services.every(s => s.status === "operational");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-6">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">System Status</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Pipeline Labs API Status</h1>
          <p className="text-muted-foreground text-lg">
            Real-time status of our API infrastructure and services
          </p>
        </div>

        {/* Overall Status */}
        <div className={`rounded-lg border p-6 mb-8 ${
          allOperational 
            ? "bg-green-500/10 border-green-500/20" 
            : "bg-yellow-500/10 border-yellow-500/20"
        }`}>
          <div className="flex items-center gap-4">
            {allOperational ? (
              <CheckCircle className="h-8 w-8 text-green-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            )}
            <div>
              <h2 className="text-xl font-semibold">
                {allOperational ? "All Systems Operational" : "Some Systems Experiencing Issues"}
              </h2>
              <p className="text-muted-foreground">
                Last updated: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Service Status Grid */}
        <div className="grid gap-4 mb-12">
          {services.map((service) => (
            <div
              key={service.name}
              className="rounded-lg border bg-card p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                {getStatusIcon(service.status)}
                <div>
                  <h3 className="font-semibold">{service.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getStatusText(service.status)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{service.uptime} uptime</p>
                <p className="text-sm text-muted-foreground">{service.responseTime} response</p>
              </div>
            </div>
          ))}
        </div>

        {/* API Endpoints */}
        <div className="rounded-lg border bg-card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
          <div className="space-y-3 font-mono text-sm">
            <div className="flex items-center justify-between p-3 rounded bg-secondary">
              <span className="text-green-500">GET</span>
              <span className="flex-1 ml-4">/api/v1/datasets</span>
              <span className="text-muted-foreground">List datasets</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary">
              <span className="text-blue-500">POST</span>
              <span className="flex-1 ml-4">/api/v1/datasets</span>
              <span className="text-muted-foreground">Create dataset</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary">
              <span className="text-green-500">GET</span>
              <span className="flex-1 ml-4">/api/v1/datasets/:id</span>
              <span className="text-muted-foreground">Get dataset</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary">
              <span className="text-yellow-500">PUT</span>
              <span className="flex-1 ml-4">/api/v1/datasets/:id</span>
              <span className="text-muted-foreground">Update dataset</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary">
              <span className="text-red-500">DELETE</span>
              <span className="flex-1 ml-4">/api/v1/datasets/:id</span>
              <span className="text-muted-foreground">Delete dataset</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm">
          <p>
            For more information, visit our{" "}
            <a href="https://docs.pipelinelabs.ai" className="text-primary hover:underline">
              API Documentation
            </a>
            {" "}or{" "}
            <a href="mailto:support@pipelinelabs.ai" className="text-primary hover:underline">
              contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
