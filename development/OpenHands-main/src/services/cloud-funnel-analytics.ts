/**
 * Where a cloud connection was initiated. Kept as a shared type for the backend
 * form and device-flow surfaces; the telemetry functions that used to live here
 * are removed (no vendor analytics in this tree).
 */
export type CloudConnectionSource =
  | "onboarding"
  | "add_backend_modal"
  | "manage_backends_modal"
  | "cloud_auto_connect";
