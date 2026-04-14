import { supabaseAdmin } from '../supabase';

type JobStatus =
  | 'pending'
  | 'provisioning'
  | 'installing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

const ACTIVE_STATUSES: JobStatus[] = ['pending', 'provisioning', 'installing', 'running'];
const TERMINAL_SUCCESS_PATTERNS = ['Training completed', 'Instance terminated'];
const TERMINAL_FAILURE_PATTERNS = ['ERROR:', 'Training failed', 'Execution failed'];

async function syncPlanStatusForJob(jobId: string, userId: string, status: 'completed' | 'failed'): Promise<void> {
  const { data: job } = await supabaseAdmin
    .from('training_jobs')
    .select('plan_id')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!job?.plan_id) {
    return;
  }

  await supabaseAdmin
    .from('training_plans')
    .update({ status })
    .eq('id', job.plan_id)
    .eq('user_id', userId);
}

export async function reconcileJobState<T extends { id: string; user_id: string; status: string; completed_at?: string | null }>(
  job: T
): Promise<T> {
  if (!ACTIVE_STATUSES.includes(job.status as JobStatus)) {
    return job;
  }

  const { data: recentLogs, error } = await supabaseAdmin
    .from('training_logs')
    .select('timestamp, level, message')
    .eq('job_id', job.id)
    .order('timestamp', { ascending: false })
    .limit(25);

  if (error || !recentLogs?.length) {
    return job;
  }

  const latestTimestamp = recentLogs[0]?.timestamp ?? new Date().toISOString();
  const hasFailure = recentLogs.some(
    (log) => log.level === 'error' || TERMINAL_FAILURE_PATTERNS.some((pattern) => log.message.includes(pattern))
  );
  const hasSuccess = recentLogs.some((log) =>
    TERMINAL_SUCCESS_PATTERNS.some((pattern) => log.message.includes(pattern))
  );

  if (!hasFailure && !hasSuccess) {
    return job;
  }

  const nextStatus: JobStatus = hasFailure ? 'failed' : 'completed';
  const completedAt = job.completed_at ?? latestTimestamp;

  await supabaseAdmin
    .from('training_jobs')
    .update({
      status: nextStatus,
      completed_at: completedAt,
      error_message: hasFailure ? 'Training failed. Review training logs for details.' : null,
    })
    .eq('id', job.id)
    .eq('user_id', job.user_id);

  await syncPlanStatusForJob(job.id, job.user_id, nextStatus === 'completed' ? 'completed' : 'failed');

  return {
    ...job,
    status: nextStatus,
    completed_at: completedAt,
  };
}
