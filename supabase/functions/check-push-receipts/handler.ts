import { failed, readBody, reply } from '../_shared/memory-http.ts';
import { callRpc, complete, expoRequest, isReceiptJob, type NotificationRpc, providerError, providerFailure,
  type ReceiptOutcome, record, workerRpc } from '../_shared/notification-http.ts';

export async function runReceipts(rpc: NotificationRpc, fetcher: typeof fetch = fetch) {
  const jobs = await callRpc(rpc, 'claim_push_receipts', { p_limit: 100, p_lease_seconds: 120 });
  if (!Array.isArray(jobs) || jobs.length > 100 || !jobs.every(isReceiptJob)) throw new Error('Invalid receipt jobs');
  const counts = { accepted: 0, pending: 0, failed: 0 };
  if (!jobs.length) return counts;
  const response = await expoRequest('getReceipts', { ids: jobs.map(job => job.ticket) }, fetcher);
  const results = await Promise.allSettled(jobs.map(async job => {
    let outcome: ReceiptOutcome;
    if (response.kind !== 'ok') {
      const failure = providerFailure(response);
      outcome = { status: failure.transient ? 'pending' : 'failed', code: failure.code };
    } else if (!record(response.data)) outcome = { status: 'pending', code: 'INVALID_PROVIDER_RESPONSE' };
    else {
      const receipt: unknown = response.data[job.ticket];
      if (receipt === undefined) outcome = { status: 'pending', code: 'RECEIPT_PENDING' };
      else if (record(receipt) && receipt.status === 'ok') outcome = { status: 'accepted' };
      else if (record(receipt) && receipt.status === 'error') {
        const code = providerError(receipt);
        outcome = code === 'DeviceNotRegistered' ? { status: 'device_not_registered' } : { status: 'failed', code };
      } else outcome = { status: 'pending', code: 'INVALID_PROVIDER_RESPONSE' };
    }
    await complete(rpc, 'complete_push_receipt', job, outcome);
    if (outcome.status === 'accepted') counts.accepted++;
    else if (outcome.status === 'pending') counts.pending++;
    else counts.failed++;
  }));
  if (results.some(result => result.status === 'rejected')) throw new Error('Receipt processing failed');
  return counts;
}

export async function handleReceipts(request: Request): Promise<Response> {
  try {
    const rpc = await workerRpc(request);
    if (rpc instanceof Response) return rpc;
    const body = await readBody(request);
    if (!body || Object.keys(body).length) return reply(failed('VALIDATION'));
    return reply({ ok: true, data: await runReceipts(rpc) });
  } catch { return reply(failed('RETRYABLE')); }
}
