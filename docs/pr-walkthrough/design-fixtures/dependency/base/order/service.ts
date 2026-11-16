import { saveOrder } from '../store/store';
export function customerKey(order: { customerId: string }) { return order.customerId; }
export function submitOrder(order: { customerId: string }) { return saveOrder(order); }
