import { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type TextInput,
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

const REGISTER_HERO = FOOD_IMAGES.hero[0]; // plated dinner

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const confirmPasswordRef = useRef<TextInput>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<
    'apple' | 'google' | null
  >(null);

  const { signUpWithEmail, signInWithApple, signInWithGoogle } = useAuth();

  const handleEmailSignUp = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { error: signUpError } = await signUpWithEmail(email, password);
      if (signUpError) {
        setError(signUpError.message);
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
          <HeroImage uri={REGISTER_HERO} height={170} gradientDirection="bottom">
            <View>
              <Text style={styles.heroTagline}>START YOUR JOURNEY</Text>
              <Text style={styles.heroTitle}>Join DinnerTime</Text>
              <Text style={styles.heroSub}>
                Create your account and start planning delicious meals.
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

            {/* NOTE: secureTextEntry gated on !__DEV__ so Maestro can inject
                text in dev/simulator UAT. Production builds always mask. */}
            <Input
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!__DEV__}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />

            <Input
              ref={confirmPasswordRef}
              testID="confirm-password-input"
              label="Confirm Password"
              placeholder="Enter password again"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!__DEV__}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleEmailSignUp}
            />

            <Button
              title="Create Account"
              onPress={handleEmailSignUp}
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
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
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

            {/* Login link */}
            <View style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                Already have an account?{' '}
              </Text>
              <Link href="/(auth)/login">
                <Text style={styles.loginLinkAction}>Sign in</Text>
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
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  errorBanner: {
    backgroundColor: 'rgba(220,38,38,0.08)',
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
    marginVertical: 16,
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
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginLinkText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  loginLinkAction: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 14,
  },
});
