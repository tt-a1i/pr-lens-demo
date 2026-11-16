import type { KeyOf } from '../contracts/keys';
export function saveOrder(order: { customerId: string }, keyOf: KeyOf) { return keyOf(order); }
