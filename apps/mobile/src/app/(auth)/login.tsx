import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { HeroImage } from '../../components/ui/HeroImage';
import { useAuth } from '../../hooks/useAuth';
import { FOOD_IMAGES } from '../../constants/foodImages';
import { colors } from '../../design/tokens';

const LOGIN_HERO = FOOD_IMAGES.hero[4]; // restaurant plating

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<
    'apple' | 'google' | null
  >(null);

  const { signInWithEmail, signInWithApple, signInWithGoogle } = useAuth();

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await signInWithEmail(email, password);
      if (signInError) {
        setError(signInError.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setSocialLoading('apple');
    try {
      const { error: appleError } = await signInWithApple();
      if (appleError) {
        setError(appleError.message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSocialLoading('google');
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setError(googleError.message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow"
          keyboardShouldPersistTaps="handled"
        >
          {/* Food hero card */}
          <HeroImage uri={LOGIN_HERO} height={220} gradientDirection="bottom">
            <View>
              <Text style={styles.heroTagline}>YOUR KITCHEN AWAITS</Text>
              <Text style={styles.heroTitle}>DinnerTime</Text>
              <Text style={styles.heroSub}>
                What's for dinner? Let's figure it out together.
              </Text>
            </View>
          </HeroImage>

          {/* Form area */}
          <View style={styles.form}>
            {/* Error banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email/Password form */}
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />

            {/* NOTE: secureTextEntry is disabled in __DEV__ builds only so
                Maestro/XCUITest can inject text during UAT. Production
                builds (App Store, TestFlight) always mask the password. */}
            <Input
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!__DEV__}
              textContentType="password"
              autoComplete="password"
            />

            <Button
              title="Sign In"
              onPress={handleEmailSignIn}
              loading={loading}
              className="mt-2"
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social sign-in buttons */}
            <View className="gap-3">
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={12}
                style={{ height: 52 }}
                onPress={handleAppleSignIn}
              />

              <Button
                title={socialLoading === 'google' ? '' : 'Continue with Google'}
                variant="secondary"
                onPress={handleGoogleSignIn}
                loading={socialLoading === 'google'}
              />
            </View>

            {/* Register link */}
            <View style={styles.registerLink}>
              <Text style={styles.registerLinkText}>
                Don't have an account?{' '}
              </Text>
              <Link href="/(auth)/register">
                <Text style={styles.registerLinkAction}>Sign up</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 2,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  errorBanner: {
    backgroundColor: 'rgba(220,38,38,0.08)', // colors.destructive @ 8%
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.textTertiary,
    fontSize: 13,
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  registerLinkText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  registerLinkAction: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 14,
  },
});
