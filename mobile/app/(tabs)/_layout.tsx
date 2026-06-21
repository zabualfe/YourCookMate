import { Tabs } from 'expo-router'
import { colors } from '@/constants/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { fontWeight: '700', color: colors.stone900 },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.stone500,
        tabBarStyle: { borderTopColor: colors.stone200 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Your Recipes',
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: 'Add Recipe',
          tabBarLabel: 'Add',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tabs>
  )
}
