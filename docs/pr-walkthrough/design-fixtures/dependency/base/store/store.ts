import { customerKey } from '../order/service';
export function saveOrder(order: { customerId: string }) { return customerKey(order); }
