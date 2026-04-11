import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>DinnerTime</Text>
      <Text style={{ fontSize: 16, color: '#666', marginTop: 8 }}>
        Your AI-powered meal planning assistant
      </Text>
    </View>
  );
}
