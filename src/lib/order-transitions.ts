import type { OrderStatus } from '@/types';
const ADMIN: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_call: ['confirmed', 'cancelled'], confirmed: ['dispatched', 'cancelled'],
  dispatched: ['confirmed', 'cancelled'], in_transit: ['delivered', 'cancelled'], delivered: ['returned'],
};
export function mayTransitionOrder(role: string, from: OrderStatus, to: OrderStatus) {
  return from === to || (role === 'admin' && (ADMIN[from] || []).includes(to));
}
