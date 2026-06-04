/** True when the enterprise SaaS settings shell is active (all dashboard pages). */
export function isEnterpriseSettingsUI() {
  return typeof document !== "undefined" && document.body.classList.contains("enterprise-ui");
}
