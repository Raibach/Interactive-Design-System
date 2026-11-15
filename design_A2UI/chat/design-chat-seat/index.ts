/**
 * THE SEAT'S PARTS — one export point for the pieces cut out of `design-chat-seat.ts`.
 *
 * The seat is the class; this folder is what the class delegates to. A part that is cut out is
 * exported here, so the seat imports one name and a reader can see the seat's size at a glance.
 */
export { seatView } from './view';
export { connectSeat, disconnectSeat } from './events';
export * from './actions';
export * from './send';
export * from './replies';
export * from './state';
