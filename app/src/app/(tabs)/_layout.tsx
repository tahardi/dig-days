import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarButtonTestID: 'tab-index' }} />
      <Tabs.Screen name="trails" options={{ title: 'Trails', tabBarButtonTestID: 'tab-trails' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarButtonTestID: 'tab-settings' }} />
    </Tabs>
  );
}
