import { failed, readBody, reply } from '../_shared/memory-http.ts';
import { callRpc, complete, expoRequest, isPushJob, type NotificationRpc, providerError, providerFailure,
  type PushOutcome, record, workerRpc } from '../_shared/notification-http.ts';

export async function runDispatch(rpc: NotificationRpc, fetcher: typeof fetch = fetch) {
  // Five concurrent jobs bound provider traffic and finish within each 120-second lease.
  const jobs = await callRpc(rpc, 'claim_due_jobs', { p_limit: 5, p_lease_seconds: 120 });
  if (!Array.isArray(jobs) || jobs.length > 5 || !jobs.every(isPushJob)) throw new Error('Invalid notification jobs');
  const counts = { submitted: 0, retried: 0, failed: 0, skipped: 0 };
  const results = await Promise.allSettled(jobs.map(async claimed => {
    const job = await callRpc(rpc, 'revalidate_notification_job', { p_id: claimed.id, p_lease_id: claimed.leaseId });
    if (job === null) { counts.skipped++; return; }
    if (!isPushJob(job) || job.id !== claimed.id || job.leaseId !== claimed.leaseId) throw new Error('Invalid notification lease');
    if (Date.parse(job.expiresAt) <= Date.now()) {
      await complete(rpc, 'complete_job', job, { status: 'failed', code: 'SOURCE_EXPIRED' });
      counts.skipped++; return;
    }
    const response = await expoRequest('send', { to: job.token, body: 'You have an update in Deseo.',
      data: { notificationId: job.notificationId }, expiration: Math.floor(Date.parse(job.expiresAt) / 1000) }, fetcher);
    let outcome: PushOutcome;
    if (response.kind !== 'ok') {
      const failure = providerFailure(response);
      outcome = { status: failure.transient ? 'retry' : 'failed', code: failure.code };
    } else if (record(response.data) && response.data.status === 'ok'
      && typeof response.data.id === 'string' && response.data.id.length > 0 && response.data.id.length <= 512) {
      outcome = { status: 'submitted', ticket: response.data.id };
    } else if (record(response.data) && response.data.status === 'error') {
      const code = providerError(response.data);
      outcome = code === 'DeviceNotRegistered' ? { status: 'device_not_registered' }
        : { status: code === 'MessageRateExceeded' ? 'retry' : 'failed', code };
    } else outcome = { status: 'retry', code: 'INVALID_PROVIDER_RESPONSE' };
    // Never send again after obtaining a ticket. SQL owns retries and receipt scheduling.
    await complete(rpc, 'complete_job', job, outcome);
    if (outcome.status === 'submitted') counts.submitted++;
    else if (outcome.status === 'retry') counts.retried++;
    else counts.failed++;
  }));
  if (results.some(result => result.status === 'rejected')) throw new Error('Notification processing failed');
  return counts;
}

export async function handleDispatch(request: Request): Promise<Response> {
  try {
    const rpc = await workerRpc(request);
    if (rpc instanceof Response) return rpc;
    const body = await readBody(request);
    if (!body || Object.keys(body).some(key => key !== 'action')) return reply(failed('VALIDATION'));
    if (body.action === 'refresh_horizon') {
      const result = await callRpc(rpc, 'refresh_notification_horizon');
      if (!record(result) || !Number.isInteger(result.refreshed) || Number(result.refreshed) < 0) throw new Error('Invalid horizon result');
      return reply({ ok: true, data: result });
    }
    if (body.action !== undefined) return reply(failed('VALIDATION'));
    return reply({ ok: true, data: await runDispatch(rpc) });
  } catch { return reply(failed('RETRYABLE')); }
}
