import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
      {/* Title row */}
      <View className="flex-row items-center justify-between mb-3">
        <Animated.View
          style={{ opacity }}
          className="bg-warmGray-200 rounded-md h-5 w-3/5"
        />
        <Animated.View
          style={{ opacity }}
          className="bg-warmGray-200 rounded-full h-5 w-16"
        />
      </View>

      {/* Cuisine tag */}
      <Animated.View
        style={{ opacity }}
        className="bg-warmGray-200 rounded-full h-4 w-20 mb-3"
      />

      {/* Description lines */}
      <Animated.View
        style={{ opacity }}
        className="bg-warmGray-200 rounded-md h-3 w-full mb-2"
      />
      <Animated.View
        style={{ opacity }}
        className="bg-warmGray-200 rounded-md h-3 w-4/5 mb-3"
      />

      {/* Time badge */}
      <Animated.View
        style={{ opacity }}
        className="bg-warmGray-200 rounded-md h-4 w-24 mb-3"
      />

      {/* Ingredient chips */}
      <View className="flex-row gap-2 mb-2">
        <Animated.View style={{ opacity }} className="bg-warmGray-200 rounded-full h-5 w-16" />
        <Animated.View style={{ opacity }} className="bg-warmGray-200 rounded-full h-5 w-20" />
        <Animated.View style={{ opacity }} className="bg-warmGray-200 rounded-full h-5 w-14" />
      </View>
    </View>
  );
}

export function SuggestionSkeleton() {
  return (
    <View>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}
