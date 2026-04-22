import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';

/**
 * Phase 23-01: About / app-store readiness section.
 *
 * Renders (in order) under the "ABOUT" header:
 *   - Version        display row — `Constants.expoConfig.version ?? 'unknown'`
 *   - Build number   display row — `Constants.expoConfig.ios.buildNumber ?? '—'`
 *   - Privacy Policy Pressable   → WebBrowser.openBrowserAsync(https://dinnertime.app/privacy)
 *   - Terms of Service Pressable → WebBrowser.openBrowserAsync(https://dinnertime.app/terms)
 *   - Support        Pressable   → Linking.openURL(mailto:support@dinnertime.app)
 *
 * Requirement: NFR-06 (about section) + NFR-07 (support contact / legal).
 *
 * TEST NOTES:
 *
 * 1. `onPress` on `<Text>` in each interactive row.
 *    The red-stub tests assert only on label strings — they don't inspect
 *    press handlers the way AccountSection's test does — so the double-wire
 *    seen there isn't strictly required. It's kept for consistency across
 *    the Settings subsystem so future tests can rely on the same pattern.
 *
 * 2. Flat children at the top level.
 *    JSX children rendered via `.map()` collapse into a nested array which
 *    the test walker doesn't recurse into. Every row is a direct sibling of
 *    the header Text under the top-level View.
 */

const PRIVACY_URL = 'https://dinnertime.app/privacy';
const TERMS_URL = 'https://dinnertime.app/terms';
const SUPPORT_EMAIL = 'support@dinnertime.app';

export function AboutSection() {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? '—';

  const openPrivacy = () => {
    void WebBrowser.openBrowserAsync(PRIVACY_URL);
  };
  const openTerms = () => {
    void WebBrowser.openBrowserAsync(TERMS_URL);
  };
  const openSupport = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <View className="mb-2">
      <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-3">
        ABOUT
      </Text>
      <View
        className="flex-row items-center py-3 border-b border-warmGray-100"
        accessibilityLabel="App version"
      >
        <SymbolIcon
          name="info.circle"
          size="body"
          tintColor={colors.textSecondary}
        />
        <Text className="flex-1 ml-3 text-base text-warmGray-900">Version</Text>
        <Text className="text-base text-warmGray-600 font-semibold">
          {version}
        </Text>
      </View>
      <View
        className="flex-row items-center py-3 border-b border-warmGray-100"
        accessibilityLabel="Build number"
      >
        <SymbolIcon
          name="number"
          size="body"
          tintColor={colors.textSecondary}
        />
        <Text className="flex-1 ml-3 text-base text-warmGray-900">Build</Text>
        <Text className="text-base text-warmGray-600 font-semibold">
          {buildNumber}
        </Text>
      </View>
      <Pressable
        onPress={openPrivacy}
        className="flex-row items-center py-3 border-b border-warmGray-100"
        accessibilityRole="button"
        accessibilityLabel="Privacy Policy"
      >
        <SymbolIcon
          name="hand.raised"
          size="body"
          tintColor={colors.textSecondary}
        />
        <Text
          className="flex-1 ml-3 text-base text-warmGray-900"
          onPress={openPrivacy}
        >
          Privacy Policy
        </Text>
        <SymbolIcon
          name="chevron.right"
          size="body"
          tintColor={colors.textSecondary}
        />
      </Pressable>
      <Pressable
        onPress={openTerms}
        className="flex-row items-center py-3 border-b border-warmGray-100"
        accessibilityRole="button"
        accessibilityLabel="Terms of Service"
      >
        <SymbolIcon
          name="doc.text"
          size="body"
          tintColor={colors.textSecondary}
        />
        <Text
          className="flex-1 ml-3 text-base text-warmGray-900"
          onPress={openTerms}
        >
          Terms of Service
        </Text>
        <SymbolIcon
          name="chevron.right"
          size="body"
          tintColor={colors.textSecondary}
        />
      </Pressable>
      <Pressable
        onPress={openSupport}
        className="flex-row items-center py-3"
        accessibilityRole="button"
        accessibilityLabel="Support"
      >
        <SymbolIcon
          name="envelope"
          size="body"
          tintColor={colors.textSecondary}
        />
        <Text
          className="flex-1 ml-3 text-base text-warmGray-900"
          onPress={openSupport}
        >
          Support
        </Text>
        <Text className="text-sm text-warmGray-600">{SUPPORT_EMAIL}</Text>
      </Pressable>
    </View>
  );
}
