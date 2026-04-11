import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';

interface ToastState {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

function ToastView({ message, type, visible }: ToastState) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1600),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible, opacity]);

  if (!visible) return null;

  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';

  return (
    <Animated.View
      style={{ opacity }}
      className={`absolute top-12 left-6 right-6 ${bgColor} rounded-xl px-4 py-3 z-50`}
    >
      <Text className="text-white text-sm font-medium text-center">
        {message}
      </Text>
    </Animated.View>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'success',
    visible: false,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type, visible: true });
    timerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2000);
  }, []);

  const ToastComponent = useCallback(
    () => <ToastView {...toast} />,
    [toast]
  );

  return { show, ToastComponent };
}
