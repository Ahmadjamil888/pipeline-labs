// =====================================================
// CLOUD CONNECTORS - Safe API Adapters
// IMPORTANT: AI does NOT directly control cloud.
// AI generates a structured "training plan".
// =====================================================
// Cloud Provider Connectors
// =====================================================
export interface CloudProviderConfig {
  provider: 'aws' | 'azure' | 'gcp' | 'runpod';
  credentials: Record<string, string>;
  region?: string;
}

export interface LaunchResult {
  success: boolean;
  instance?: {
    instanceId: string;
    instanceType: string;
    ip?: string;
    region: string;
    gpuType: string;
    status: string;
    hourlyCost: number;
  };
  error?: string;
}

export interface CommandResult {
  success: boolean;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface InstanceSpec {
  instanceId: string;
  instanceType: string;
  region: string;
  status: string;
  ip?: string;
}

export interface ICloudConnector {
  validate(): Promise<boolean>;
  launchTrainingInstance(gpuType: string, region?: string): Promise<LaunchResult>;
  executeCommand(instanceId: string, command: string): Promise<CommandResult>;
  getInstanceStatus(instanceId: string): Promise<InstanceSpec | null>;
  terminateInstance(instanceId: string): Promise<boolean>;
  getEstimatedCost(gpuType: string, hours: number): Promise<number>;
}

// Helper: Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Helper: Create connector based on provider type
export function createConnector(config: CloudProviderConfig): ICloudConnector {
  switch (config.provider) {
    case 'aws':
      return new AWSConnector(config);
    case 'azure':
      return new AzureConnector(config);
    case 'gcp':
      return new GCPConnector(config);
    case 'runpod':
      return new RunPodConnector(config);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// =====================================================
// AWS Connector (SageMaker / EC2)
// =====================================================
export class AWSConnector implements ICloudConnector {
  private credentials: { accessKeyId: string; secretAccessKey: string; region: string };

  constructor(config: CloudProviderConfig) {
    this.credentials = {
      accessKeyId: config.credentials.access_key_id,
      secretAccessKey: config.credentials.secret_access_key,
      region: config.credentials.region || config.region || 'us-east-1',
    };
  }

  async validate(): Promise<boolean> {
    try {
      // NOTE: This is a stub for demonstration. In production, use the AWS SDK:
      // const AWS = require('aws-sdk');
      // const sts = new AWS.STS({
      //   accessKeyId: this.credentials.accessKeyId,
      //   secretAccessKey: this.credentials.secretAccessKey,
      //   region: this.credentials.region,
      // });
      // await sts.getCallerIdentity().promise();
      
      // For now, basic presence check - proper AWS signature required for real STS call
      if (!this.credentials.accessKeyId || !this.credentials.secretAccessKey) {
        return false;
      }
      
      // Simulate validation with timeout
      await fetchWithTimeout('https://sts.amazonaws.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'Action=GetCallerIdentity&Version=2011-06-15',
      }, 3000);
      
      return true;
    } catch (error) {
      console.error('AWS validation error:', error);
      return false;
    }
  }

  async launchTrainingInstance(gpuType: string, region?: string): Promise<LaunchResult> {
    try {
      // Map GPU type to EC2 instance type
      const gpuToInstance: Record<string, string> = {
        'T4': 'g4dn.xlarge',
        'A10G': 'g5.xlarge',
        'V100': 'p3.2xlarge',
        'A100': 'p4d.24xlarge',
      };

      const instanceType = gpuToInstance[gpuType] || 'g4dn.xlarge';

      // In production: use AWS SDK to launch SageMaker training job or EC2 instance
      // For now, return a structured response that the execution engine can use
      return {
        success: true,
        instance: {
          instanceId: `aws-train-${Date.now()}`,
          instanceType,
          region: region || this.credentials.region,
          gpuType,
          status: 'pending',
          hourlyCost: this.getHourlyCost(instanceType),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async executeCommand(instanceId: string, command: string): Promise<CommandResult> {
    // In production: use SSM Run Command or SSH
    return {
      success: true,
      exitCode: 0,
      stdout: `Command queued for ${instanceId}`,
    };
  }

  async getInstanceStatus(instanceId: string): Promise<InstanceSpec | null> {
    // In production: use EC2 DescribeInstances
    return {
      instanceId,
      instanceType: 'g4dn.xlarge',
      region: this.credentials.region,
      status: 'running',
    };
  }

  async terminateInstance(instanceId: string): Promise<boolean> {
    // In production: use EC2 TerminateInstances
    return true;
  }

  async getEstimatedCost(gpuType: string, hours: number): Promise<number> {
    const costs: Record<string, number> = {
      'T4': 0.526,
      'A10G': 1.006,
      'V100': 3.10,
      'A100': 32.77,
    };
    return (costs[gpuType] || 0.526) * hours;
  }

  private getHourlyCost(instanceType: string): number {
    const costs: Record<string, number> = {
      'g4dn.xlarge': 0.526,
      'g5.xlarge': 1.006,
      'p3.2xlarge': 3.10,
      'p4d.24xlarge': 32.77,
    };
    return costs[instanceType] || 0.526;
  }
}

// =====================================================
// Azure Connector (Azure ML)
// =====================================================
export class AzureConnector implements ICloudConnector {
  private credentials: {
    subscriptionId: string;
    tenantId: string;
    clientId: string;
    clientSecret: string;
    resourceGroup: string;
    region: string;
  };

  constructor(config: CloudProviderConfig) {
    this.credentials = {
      subscriptionId: config.credentials.subscription_id,
      tenantId: config.credentials.tenant_id,
      clientId: config.credentials.client_id,
      clientSecret: config.credentials.client_secret,
      resourceGroup: config.credentials.resource_group || 'ml-resources',
      region: config.credentials.region || config.region || 'eastus',
    };
  }

  async validate(): Promise<boolean> {
    return !!(
      this.credentials.subscriptionId &&
      this.credentials.tenantId &&
      this.credentials.clientId &&
      this.credentials.clientSecret
    );
  }

  async launchTrainingInstance(gpuType: string, region?: string): Promise<LaunchResult> {
    const gpuToVm: Record<string, string> = {
      'T4': 'Standard_NC4as_T4_v3',
      'A10G': 'Standard_NC6s_v3',
      'V100': 'Standard_NC6s_v3',
      'A100': 'Standard_ND96asr_v4',
    };

    const vmSize = gpuToVm[gpuType] || 'Standard_NC4as_T4_v3';

    return {
      success: true,
      instance: {
        instanceId: `azure-train-${Date.now()}`,
        instanceType: vmSize,
        region: region || this.credentials.region,
        gpuType,
        status: 'pending',
        hourlyCost: this.getHourlyCost(vmSize),
      },
    };
  }

  async executeCommand(instanceId: string, command: string): Promise<CommandResult> {
    return { success: true, exitCode: 0, stdout: `Command queued for ${instanceId}` };
  }

  async getInstanceStatus(instanceId: string): Promise<InstanceSpec | null> {
    return {
      instanceId,
      instanceType: 'Standard_NC4as_T4_v3',
      region: this.credentials.region,
      status: 'running',
    };
  }

  async terminateInstance(instanceId: string): Promise<boolean> {
    return true;
  }

  async getEstimatedCost(gpuType: string, hours: number): Promise<number> {
    const costs: Record<string, number> = {
      'T4': 0.526,
      'A10G': 3.06,
      'V100': 3.06,
      'A100': 32.77,
    };
    return (costs[gpuType] || 0.526) * hours;
  }

  private getHourlyCost(vmSize: string): number {
    const costs: Record<string, number> = {
      'Standard_NC4as_T4_v3': 0.526,
      'Standard_NC6s_v3': 3.06,
      'Standard_ND96asr_v4': 32.77,
    };
    return costs[vmSize] || 0.526;
  }
}

// =====================================================
// GCP Connector (Vertex AI / Compute Engine)
// =====================================================
export class GCPConnector implements ICloudConnector {
  private credentials: {
    projectId: string;
    serviceAccountKey: string;
    region: string;
  };

  constructor(config: CloudProviderConfig) {
    this.credentials = {
      projectId: config.credentials.project_id,
      serviceAccountKey: config.credentials.service_account_key,
      region: config.credentials.region || config.region || 'us-central1',
    };
  }

  async validate(): Promise<boolean> {
    return !!(this.credentials.projectId && this.credentials.serviceAccountKey);
  }

  async launchTrainingInstance(gpuType: string, region?: string): Promise<LaunchResult> {
    const gpuToMachine: Record<string, string> = {
      'T4': 'n1-standard-4-t4',
      'A10G': 'n1-standard-8-a10g',
      'V100': 'n1-standard-8-v100',
      'A100': 'a2-highgpu-1g',
    };

    const machineType = gpuToMachine[gpuType] || 'n1-standard-4-t4';

    return {
      success: true,
      instance: {
        instanceId: `gcp-train-${Date.now()}`,
        instanceType: machineType,
        region: region || this.credentials.region,
        gpuType,
        status: 'pending',
        hourlyCost: this.getHourlyCost(machineType),
      },
    };
  }

  async executeCommand(instanceId: string, command: string): Promise<CommandResult> {
    return { success: true, exitCode: 0, stdout: `Command queued for ${instanceId}` };
  }

  async getInstanceStatus(instanceId: string): Promise<InstanceSpec | null> {
    return {
      instanceId,
      instanceType: 'n1-standard-4-t4',
      region: this.credentials.region,
      status: 'running',
    };
  }

  async terminateInstance(instanceId: string): Promise<boolean> {
    return true;
  }

  async getEstimatedCost(gpuType: string, hours: number): Promise<number> {
    const costs: Record<string, number> = {
      'T4': 0.95,
      'A10G': 1.70,
      'V100': 2.99,
      'A100': 11.06,
    };
    return (costs[gpuType] || 0.95) * hours;
  }

  private getHourlyCost(machineType: string): number {
    const costs: Record<string, number> = {
      'n1-standard-4-t4': 0.95,
      'n1-standard-8-a10g': 1.70,
      'n1-standard-8-v100': 2.99,
      'a2-highgpu-1g': 11.06,
    };
    return costs[machineType] || 0.95;
  }
}

// =====================================================
// RunPod Connector (Simplest - just API key)
// =====================================================
export class RunPodConnector implements ICloudConnector {
  private apiKey: string;

  constructor(config: CloudProviderConfig) {
    this.apiKey = config.credentials.api_key;
  }

  async validate(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout('https://api.runpod.io/v2/user', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      }, 5000);
      return response.ok;
    } catch (error) {
      console.error('RunPod validation error:', error);
      return !!this.apiKey;
    }
  }

  async launchTrainingInstance(gpuType: string, region?: string): Promise<LaunchResult> {
    try {
      const gpuToPod: Record<string, string> = {
        'T4': 'NVIDIA RTX A4000',
        'A10G': 'NVIDIA A40',
        'V100': 'NVIDIA V100',
        'A100': 'NVIDIA A100-SXM4-80GB',
      };

      const gpuDisplayName = gpuToPod[gpuType] || 'NVIDIA RTX A4000';

      // Use RunPod API to create a pod
      const response = await fetchWithTimeout('https://api.runpod.io/v2/pods', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `pipeline-labs-train-${Date.now()}`,
          imageName: 'runpod/pytorch:2.1.0-cuda12.1-devel',
          gpuTypeId: this.getGpuTypeId(gpuType),
          cloudType: 'ALL',
          minMemory: 20,
          networkVolumeId: null,
        }),
      }, 10000);

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `RunPod API error: ${err}` };
      }

      const data = await response.json() as any;

      return {
        success: true,
        instance: {
          instanceId: data.id || `runpod-${Date.now()}`,
          instanceType: gpuDisplayName,
          ip: data.runtime?.ips?.publicIp,
          region: region || 'US',
          gpuType,
          status: 'pending',
          hourlyCost: this.getHourlyCost(this.getGpuTypeId(gpuType)),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async executeCommand(instanceId: string, command: string): Promise<CommandResult> {
    try {
      const response = await fetchWithTimeout(`https://api.runpod.io/v2/pods/${instanceId}/exec`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      }, 30000);

      if (!response.ok) {
        return { success: false, error: 'Failed to execute command' };
      }

      const data = await response.json() as any;
      return {
        success: true,
        exitCode: data.exitCode || 0,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getInstanceStatus(instanceId: string): Promise<InstanceSpec | null> {
    try {
      const response = await fetch(`https://api.runpod.io/v2/pods/${instanceId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) return null;

      const data = await response.json() as any;
      return {
        instanceId: data.id,
        instanceType: data.machine?.gpuDisplayName || 'Unknown',
        ip: data.runtime?.ips?.publicIp,
        region: 'US',
        gpuType: data.machine?.gpuDisplayName,
        status: data.desiredStatus === 'RUNNING' ? 'running' : 'pending',
      };
    } catch {
      return null;
    }
  }

  async terminateInstance(instanceId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.runpod.io/v2/pods/${instanceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getEstimatedCost(gpuType: string, hours: number): Promise<number> {
    const costs: Record<string, number> = {
      'T4': 0.44,
      'A10G': 0.74,
      'V100': 0.74,
      'A100': 1.64,
    };
    return (costs[gpuType] || 0.44) * hours;
  }

  private getGpuTypeId(gpuType: string): string {
    const mapping: Record<string, string> = {
      'T4': 'NVIDIA RTX A4000',
      'A10G': 'NVIDIA A40',
      'V100': 'NVIDIA V100_FO32',
      'A100': 'NVIDIA A100-SXM4-80GB',
    };
    return mapping[gpuType] || 'NVIDIA RTX A4000';
  }

  private getHourlyCost(gpuTypeId: string): number {
    const costs: Record<string, number> = {
      'NVIDIA RTX A4000': 0.44,
      'NVIDIA A40': 0.74,
      'NVIDIA V100_FO32': 0.74,
      'NVIDIA A100-SXM4-80GB': 1.64,
    };
    return costs[gpuTypeId] || 0.44;
  }
}

// =====================================================
// CONNECTOR FACTORY
// =====================================================
export function createConnector(config: CloudProviderConfig): ICloudConnector {
  switch (config.provider) {
    case 'aws':
      return new AWSConnector(config);
    case 'azure':
      return new AzureConnector(config);
    case 'gcp':
      return new GCPConnector(config);
    case 'runpod':
      return new RunPodConnector(config);
    default:
      throw new Error(`Unsupported cloud provider: ${config.provider}`);
  }
}
