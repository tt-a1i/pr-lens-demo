import { saveOrder } from '../store/store';
import type { KeyOf } from '../contracts/keys';
const customerKey: KeyOf = order => order.customerId;
export function submitOrder(order: { customerId: string }) { return saveOrder(order, customerKey); }
