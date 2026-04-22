/**
 * Phase 20 Wave 0 stub — real implementation lands in 20-03.
 *
 * Deep-link-first handoff helper: try `Linking.openURL(url)` first (iOS
 * universal links route to the Instacart app when installed, otherwise
 * Safari), fall back to `expo-web-browser` on failure (Safari View
 * Controller in-app). See 20-RESEARCH.md Pitfall 2 for rationale on
 * skipping `canOpenURL` probe in v1.
 *
 * TODO(phase-20-03): wire real Linking.openURL + WebBrowser.openBrowserAsync
 * fallback. See 20-RESEARCH.md Pattern 1.
 */

export async function openInstacartCart(_url: string): Promise<void> {
  throw new Error('Phase 20-03 not implemented');
}
