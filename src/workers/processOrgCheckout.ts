import type { QueuedCheckoutJob } from "../queue/checkoutQueue.js";

export interface StripePaymentIntentResponse {
  id: string;
  status: "succeeded" | "requires_action";
}

export async function processOrgCheckout(job: QueuedCheckoutJob): Promise<{ invoiceId: string; status: string }> {
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      "Idempotency-Key": job.idempotencyKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: job.amountCents,
      currency: "usd",
      confirm: true,
      metadata: {
        orgId: job.orgId,
        invoiceId: job.invoiceId,
        seatCount: job.seatCount,
      },
    }),
  });

  const intent = (await res.json()) as StripePaymentIntentResponse;
  return {
    invoiceId: job.invoiceId,
    status: intent.status === "succeeded" ? "paid" : "pending_action",
  };
}
