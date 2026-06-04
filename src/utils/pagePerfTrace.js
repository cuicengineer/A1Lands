/** Dev-only page performance tracing (console.time / render counts). */
export const PAGE_PERF_TRACE =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

export function perfMark(label) {
  if (!PAGE_PERF_TRACE) return;
  console.time(`[perf] ${label}`);
}

export function perfEnd(label) {
  if (!PAGE_PERF_TRACE) return;
  console.timeEnd(`[perf] ${label}`);
}

export function perfLog(label, detail) {
  if (!PAGE_PERF_TRACE) return;
  console.log(`[perf] ${label}`, detail ?? "");
}
