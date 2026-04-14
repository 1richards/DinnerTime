import { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type TextInput,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';

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
    <SafeAreaView className="flex-1 bg-warmWhite">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="items-center mb-10">
            <Text className="text-5xl mb-3">🍽️</Text>
            <Text className="text-3xl font-bold text-warmGray-900">
              Join DinnerTime
            </Text>
            <Text className="text-base text-warmGray-500 mt-2 text-center">
              Create your account and start planning delicious meals.
            </Text>
          </View>

          {/* Error banner */}
          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <Text className="text-red-600 text-sm text-center">{error}</Text>
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

          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
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
            secureTextEntry
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
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-warmGray-200" />
            <Text className="mx-4 text-warmGray-400 text-sm">
              or continue with
            </Text>
            <View className="flex-1 h-px bg-warmGray-200" />
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
              variant="outline"
              onPress={handleGoogleSignIn}
              loading={socialLoading === 'google'}
            />
          </View>

          {/* Login link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-warmGray-500">
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login">
              <Text className="text-orange-500 font-semibold">Sign in</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
