import type { InputActionHost } from './host';

/** STOP — the one control the person presses while a call is in flight. */
export const stopAction = (host: InputActionHost): void => {
  host._abort?.abort();
};
