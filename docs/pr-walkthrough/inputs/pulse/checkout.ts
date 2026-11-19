import { claimCheckoutLock } from "../lib/idempotency.js";
import { enqueueCheckoutJob } from "../queue/checkoutQueue.js";

export interface OrgCheckoutRequest {
  orgId: string;
  seatCount: number;
  amountCents: number;
  idempotencyKey: string;
}

export async function postCheckout(req: OrgCheckoutRequest) {
  const invoiceId = `inv_${req.idempotencyKey.slice(0, 8)}`;
  const lock = await claimCheckoutLock(req.idempotencyKey, {
    orgId: req.orgId,
    invoiceId,
    ttlSeconds: 86400,
  });

  if (!lock.acquired) {
    return { status: 202, body: { invoiceId: lock.existingInvoiceId, status: "queued" as const } };
  }

  const { jobId } = await enqueueCheckoutJob({
    invoiceId,
    orgId: req.orgId,
    seatCount: req.seatCount,
    amountCents: req.amountCents,
    idempotencyKey: req.idempotencyKey,
  });

  return {
    status: 202,
    body: { invoiceId, jobId, status: "queued" as const },
  };
}
