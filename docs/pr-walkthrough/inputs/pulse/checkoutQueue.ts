export interface QueuedCheckoutJob {
  invoiceId: string;
  orgId: string;
  seatCount: number;
  amountCents: number;
  idempotencyKey: string;
}

export async function enqueueCheckoutJob(job: QueuedCheckoutJob): Promise<{ jobId: string }> {
  return { jobId: `job_${job.invoiceId}` };
}
