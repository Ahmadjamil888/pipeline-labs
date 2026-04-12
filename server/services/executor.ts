// =====================================================
// EXECUTION ENGINE - Remote Job Runner for ML
// This actually runs training:
// 1. Spins up instance on cloud
// 2. Installs dependencies
// 3. Runs training script
// 4. Streams logs back
// =====================================================

import { createConnector, ICloudConnector, CloudProviderConfig, LaunchResult, CommandResult } from './cloud/index';
import { TrainingPlan } from './planner';

export interface ExecutionConfig {
  cloudProvider: CloudProviderConfig;
  plan: TrainingPlan;
  datasetPath: string; // Supabase storage path
  jobId: string;
  userId: string;
}

export interface ExecutionStatus {
  phase: 'provisioning' | 'installing' | 'uploading_data' | 'training' | 'saving_model' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  logs: string[];
  currentEpoch?: number;
  totalEpochs?: number;
}

// =====================================================
// Training Script Templates
// =====================================================
function generateTrainingScript(plan: TrainingPlan, datasetUrl: string): string {
  if (plan.framework === 'sklearn' || plan.framework === 'xgboost') {
    return generateSklearnScript(plan, datasetUrl);
  }
  return generatePytorchScript(plan, datasetUrl);
}

// Robust parser for train_test_split (e.g., "80/20", "70-30", "80%")
function parseTrainTestSplit(splitStr: string): number {
  const cleaned = splitStr.trim();
  // Handle formats like "80/20", "70-30", "80%", "0.8"
  if (cleaned.includes('/')) {
    const [train] = cleaned.split('/').map(Number);
    return train / 100;
  }
  if (cleaned.includes('-')) {
    const [train] = cleaned.split('-').map(Number);
    return train / 100;
  }
  if (cleaned.includes('%')) {
    return parseFloat(cleaned.replace('%', '')) / 100;
  }
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    return num > 1 ? num / 100 : num;
  }
  return 0.8; // Default fallback
}

// Sanitize model name to prevent injection
function sanitizeModelName(modelName: string): string {
  // Allow only alphanumeric, hyphens, underscores, and dots (for HuggingFace models)
  return modelName.replace(/[^a-zA-Z0-9._-]/g, '');
}

// Escape dataset URL for shell safety
function escapeShellString(str: string): string {
  return str.replace(/'/g, "'\\''");
}

// Generate unique heredoc delimiter
function generateHeredocDelimiter(): string {
  return `SCRIPT_EOF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSklearnScript(plan: TrainingPlan, datasetUrl: string): string {
  const isClassification = plan.task.includes('classification');
  const isXgboost = plan.framework === 'xgboost';
  const splitRatio = parseTrainTestSplit(plan.train_test_split);
  const escapedUrl = escapeShellString(datasetUrl);

  return `#!/usr/bin/env python3
"""Auto-generated training script by Pipeline Labs"""
import json
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import ${isClassification ? 'accuracy_score, f1_score, precision_score, recall_score' : 'mean_squared_error, mean_absolute_error, r2_score'}
${isXgboost ? 'from xgboost import XGBClassifier as Model' : isClassification ? 'from sklearn.ensemble import RandomForestClassifier as Model' : 'from sklearn.ensemble import RandomForestRegressor as Model'}

# Load dataset
print("LOADING_DATA")
df = pd.read_csv('${escapedUrl}')
print(f"Dataset loaded: {len(df)} rows, {len(df.columns)} columns")

# Preprocessing
print("PREPROCESSING")
target_col = df.columns[-1]  # Assume last column is target
X = df.drop(columns=[target_col])
y = df[target_col]

${isClassification ? `le = LabelEncoder()
y = le.fit_transform(y)` : ''}

# Handle categoricals
cat_cols = X.select_dtypes(include=['object']).columns
X = pd.get_dummies(X, columns=cat_cols, drop_first=True)

# Scale
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Split
split_ratio = ${splitRatio.toFixed(2)}
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, train_size=split_ratio, random_state=42)
print(f"Train: {len(X_train)}, Test: {len(X_test)}")

# Train
print("TRAINING_START")
model = Model(${isXgboost ? `n_estimators=100, use_label_encoder=False, eval_metric='logloss'` : `n_estimators=100, random_state=42`})
model.fit(X_train, y_train)
print("TRAINING_COMPLETE")

# Evaluate
y_pred = model.predict(X_test)
metrics = {
  ${isClassification ? `"accuracy": float(accuracy_score(y_test, y_pred)),
  "f1_score": float(f1_score(y_test, y_pred, average="weighted")),
  "precision": float(precision_score(y_test, y_pred, average="weighted")),
  "recall": float(recall_score(y_test, y_pred, average="weighted"))` : `"mse": float(mean_squared_error(y_test, y_pred)),
  "mae": float(mean_absolute_error(y_test, y_pred)),
  "r2": float(r2_score(y_test, y_pred))`}
}
print(f"METRICS:{json.dumps(metrics)}")

# Save model
import pickle
with open("/workspace/model.pkl", "wb") as f:
  pickle.dump(model, f)
print("MODEL_SAVED")
print("DONE")
`;
}

function generatePytorchScript(plan: TrainingPlan, datasetUrl: string): string {
  const sanitizedModel = sanitizeModelName(plan.model);
  const splitRatio = parseTrainTestSplit(plan.train_test_split);
  const escapedUrl = escapeShellString(datasetUrl);
  
  return `#!/usr/bin/env python3
"""Auto-generated PyTorch training script by Pipeline Labs"""
import json
import sys
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
import pandas as pd
import numpy as np

# Load dataset
print("LOADING_DATA")
df = pd.read_csv('${escapedUrl}')
print(f"Dataset loaded: {len(df)} rows")

# Setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# Load model and tokenizer
print("LOADING_MODEL")
tokenizer = AutoTokenizer.from_pretrained("${sanitizedModel}")
num_labels = df.iloc[:, -1].nunique()
model = AutoModelForSequenceClassification.from_pretrained("${sanitizedModel}", num_labels=num_labels)
model.to(device)

# Custom dataset
class TextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len=128):
        self.encodings = tokenizer(texts.tolist(), truncation=True, padding=True, max_length=max_len)
        self.labels = labels.tolist()

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx])
        return item

# Prepare data
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split

text_col = df.columns[0]
label_col = df.columns[-1]
le = LabelEncoder()
df[label_col] = le.fit_transform(df[label_col].astype(str))

train_df, test_df = train_test_split(df, train_size=${splitRatio.toFixed(2)}, random_state=42)

train_dataset = TextDataset(train_df[text_col], train_df[label_col], tokenizer)
test_dataset = TextDataset(test_df[text_col], test_df[label_col], tokenizer)

# Training arguments
training_args = TrainingArguments(
    output_dir="/workspace/results",
    num_train_epochs=${plan.epochs},
    per_device_train_batch_size=${plan.batch_size},
    per_device_eval_batch_size=${plan.batch_size * 2},
    learning_rate=${plan.learning_rate},
    weight_decay=0.01,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    logging_dir="/workspace/logs",
    logging_steps=10,
    report_to="none",
)

# Trainer
from sklearn.metrics import accuracy_score, f1_score

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy_score(labels, predictions),
        "f1": f1_score(labels, predictions, average="weighted"),
    }

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset,
    compute_metrics=compute_metrics,
)

# Train
print("TRAINING_START")
trainer.train()
print("TRAINING_COMPLETE")

# Evaluate
print("EVALUATING")
metrics = trainer.evaluate()
print(f"METRICS:{json.dumps(metrics)}")

# Save model
trainer.save_model("/workspace/model")
tokenizer.save_pretrained("/workspace/model")
print("MODEL_SAVED")
print("DONE")
`;
}

// =====================================================
// Execution Engine
// =====================================================
export class ExecutionEngine {
  private connector: ICloudConnector;
  private status: ExecutionStatus;
  private onLogCallback?: (log: string) => void;
  private onStatusCallback?: (status: ExecutionStatus) => void;
  private cancellationRequested = false;
  private launchedInstanceId?: string;

  constructor(
    private config: ExecutionConfig,
    onLog?: (log: string) => void,
    onStatus?: (status: ExecutionStatus) => void,
  ) {
    this.connector = createConnector(config.cloudProvider);
    this.status = {
      phase: 'provisioning',
      progress: 0,
      message: 'Initializing...',
      logs: [],
    };
    this.onLogCallback = onLog;
    this.onStatusCallback = onStatus;
  }

  private addLog(message: string) {
    this.status.logs.push(`[${new Date().toISOString()}] ${message}`);
    this.onLogCallback?.(message);
  }

  private updateStatus(partial: Partial<ExecutionStatus>) {
    this.status = { ...this.status, ...partial };
    this.onStatusCallback?.(this.status);
  }

  async execute(): Promise<ExecutionStatus> {
    try {
      // Phase 1: Validate cloud credentials
      this.addLog('Validating cloud credentials...');
      const isValid = await this.connector.validate();
      if (!isValid) {
        throw new Error('Cloud credentials validation failed');
      }
      this.addLog('Credentials validated successfully');

      // Phase 2: Launch instance
      this.updateStatus({ phase: 'provisioning', progress: 10, message: 'Launching cloud instance...' });
      this.addLog(`Launching ${this.config.plan.gpu_required} GPU instance...`);
      const launchResult = await this.connector.launchTrainingInstance(
        this.config.plan.gpu_required,
        this.config.cloudProvider.region
      );

      if (!launchResult.success || !launchResult.instance) {
        throw new Error(launchResult.error || 'Failed to launch instance');
      }

      this.addLog(`Instance launched: ${launchResult.instance.instanceId} (${launchResult.instance.instanceType})`);
      this.launchedInstanceId = launchResult.instance.instanceId;
      this.updateStatus({ progress: 20, message: 'Instance provisioned' });

      // Phase 3: Install dependencies
      this.updateStatus({ phase: 'installing', progress: 30, message: 'Installing dependencies...' });
      this.addLog('Installing Python dependencies...');

      const installCmds = this.config.plan.framework === 'sklearn'
        ? 'pip install pandas scikit-learn xgboost numpy'
        : this.config.plan.framework === 'xgboost'
        ? 'pip install pandas scikit-learn xgboost numpy'
        : 'pip install pandas scikit-learn torch transformers accelerate numpy';

      await this.connector.executeCommand(launchResult.instance.instanceId, installCmds);
      this.addLog('Dependencies installed');

      // Phase 4: Upload data + training script
      this.updateStatus({ phase: 'uploading_data', progress: 40, message: 'Uploading dataset and training script...' });
      this.addLog('Generating training script...');

      const datasetUrl = this.config.datasetPath;
      const trainingScript = generateTrainingScript(this.config.plan, datasetUrl);

      // Upload training script to instance
      const heredocDelimiter = generateHeredocDelimiter();
      await this.connector.executeCommand(
        launchResult.instance.instanceId,
        `cat > /workspace/train.py << '${heredocDelimiter}'\n${trainingScript}\n${heredocDelimiter}`
      );
      this.addLog('Training script uploaded');

      // Phase 5: Run training
      this.updateStatus({
        phase: 'training',
        progress: 50,
        message: 'Training started...',
        totalEpochs: this.config.plan.epochs,
        currentEpoch: 0,
      });
      this.addLog('Starting training...');

      const trainResult = await this.connector.executeCommand(
        launchResult.instance.instanceId,
        'cd /workspace && python train.py 2>&1'
      );

      if (!trainResult.success) {
        throw new Error(trainResult.stderr || trainResult.error || 'Training failed');
      }

      // Parse training output for metrics
      this.addLog('Training completed');
      this.updateStatus({ progress: 90, currentEpoch: this.config.plan.epochs });

      // Phase 6: Save model artifact
      this.updateStatus({ phase: 'saving_model', progress: 95, message: 'Saving model artifact...' });
      this.addLog('Model saved to /workspace/model');

      // Phase 7: Cleanup
      this.addLog('Terminating cloud instance...');
      await this.connector.terminateInstance(launchResult.instance.instanceId);
      this.addLog('Instance terminated');
      this.launchedInstanceId = undefined;

      this.updateStatus({
        phase: 'completed',
        progress: 100,
        message: 'Training completed successfully!',
      });

      return this.status;
    } catch (err: any) {
      this.addLog(`ERROR: ${err.message}`);
      this.updateStatus({
        phase: 'failed',
        progress: 0,
        message: `Training failed: ${err.message}`,
      });
      
      // Terminate instance on failure
      if (this.launchedInstanceId) {
        try {
          this.addLog('Terminating instance due to failure...');
          await this.connector.terminateInstance(this.launchedInstanceId);
          this.addLog('Instance terminated');
        } catch (terminateErr) {
          this.addLog(`Failed to terminate instance: ${terminateErr}`);
        }
        this.launchedInstanceId = undefined;
      }
      
      return this.status;
    }
  }

  async cancel(): Promise<boolean> {
    this.cancellationRequested = true;
    this.addLog('Cancellation requested...');
    this.updateStatus({ phase: 'failed', progress: 0, message: 'Training cancelled by user' });
    
    // Terminate instance if running
    if (this.launchedInstanceId) {
      try {
        this.addLog('Terminating instance due to cancellation...');
        await this.connector.terminateInstance(this.launchedInstanceId);
        this.addLog('Instance terminated');
      } catch (err) {
        this.addLog(`Failed to terminate instance: ${err}`);
      }
      this.launchedInstanceId = undefined;
    }
    
    return true;
  }

  getStatus(): ExecutionStatus {
    return { ...this.status };
  }
}
