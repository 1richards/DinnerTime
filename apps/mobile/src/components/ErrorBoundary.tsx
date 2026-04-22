/**
 * Global React error boundary (Phase 23-05 / NFR-12).
 *
 * Catches any uncaught render error in the app tree and shows a friendly
 * fallback (app logo + title + Restart button + Report issue button) in
 * place of the default white-screen-of-death.
 *
 * Reports the error to Sentry via the PII-scrubbed wrapper at
 * `../lib/sentry`. The wrapper is imported statically here because 23-06
 * already ships it and the wrapper's own `initSentry` no-ops when no DSN
 * is configured — so tests and local dev never blow up on import.
 *
 * Still, `captureError` wraps the call in try/catch as an extra safety
 * net: if the Sentry bridge itself throws (broken install, native-module
 * mismatch), the error boundary must NEVER fail to render the fallback.
 */
import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';

import { captureException } from '../lib/sentry';
import { colors } from '../design/tokens';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    ErrorBoundary.captureError(error, info);
  }

  /**
   * Static-ish side-effect hook — extracted so tests can assert the
   * Sentry-ward call without mounting a full React tree. Wraps the call
   * in try/catch so a broken Sentry install can never mask the original
   * render error.
   */
  static captureError(error: Error, info: React.ErrorInfo): void {
    try {
      captureException(error, {
        tags: { source: 'error_boundary' },
        // Pass componentStack under a `contexts`-shaped opts — the 23-06
        // beforeSend hook scrubs PII from this payload before send.
        contexts: { react: { componentStack: info.componentStack } },
      } as unknown as { tags: Record<string, string> });
    } catch {
      // Sentry not wired / bridge threw — swallow so we still render the
      // fallback. The original error is still visible in dev via red-box.
    }
  }

  handleRestart = (): void => {
    // Reset local state so the render attempt retries. If the underlying
    // bug is deterministic, the boundary catches again and we stay on the
    // fallback — user can then tap "Report issue" to email support.
    this.setState({ error: null });
  };

  handleReport = (): void => {
    const err = this.state.error;
    const subject = encodeURIComponent('Issue in DinnerTime');
    const body = encodeURIComponent(
      `Something went wrong in the app.\n\n` +
        `Error: ${err?.message ?? 'unknown'}\n` +
        `Stack:\n${err?.stack ?? '(no stack)'}\n\n` +
        `What were you doing when this happened?\n`,
    );
    const url = `mailto:support@dinnertime.app?subject=${subject}&body=${body}`;
    // Linking.openURL is async but we don't await — it returns a Promise
    // that the boundary can't meaningfully act on. Catch swallows any
    // "URL could not be opened" so the fallback stays stable.
    Linking.openURL(url).catch(() => {
      /* noop */
    });
  };

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View
        testID="error-boundary-fallback"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          backgroundColor: colors.bg,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: colors.textPrimary,
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          The app hit an unexpected error. Tap Restart to try again, or Report
          issue to let us know.
        </Text>
        <Pressable
          onPress={this.handleRestart}
          accessibilityRole="button"
          accessibilityLabel="Restart"
          style={{
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 12,
            backgroundColor: colors.brand,
            marginBottom: 12,
            minWidth: 200,
            alignItems: 'center',
          }}
        >
          {'Restart'}
        </Pressable>
        <Pressable
          onPress={this.handleReport}
          accessibilityRole="button"
          accessibilityLabel="Report issue"
          style={{
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            minWidth: 200,
            alignItems: 'center',
          }}
        >
          {'Report issue'}
        </Pressable>
      </View>
    );
  }
}

export default ErrorBoundary;
