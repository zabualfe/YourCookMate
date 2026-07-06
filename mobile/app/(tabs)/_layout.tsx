import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { BrandLogo } from '@/components/BrandLogo'
import { colors, fonts } from '@/constants/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderBottomColor: colors.stone200,
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          fontFamily: fonts.displayBold,
          fontWeight: '700',
          color: colors.stone900,
        },
        headerShadowVisible: false,
        headerTitle: () => <BrandLogo size="sm" />,
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.stone500,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.stone200,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansSemiBold,
          fontSize: 11,
        },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Your Cook Mate',
          tabBarLabel: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
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
          title: 'Your Cook Mate',
          tabBarLabel: 'Add',
          headerTitle: 'Add a recipe',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Your Cook Mate',
          tabBarLabel: 'Profile',
          headerTitle: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
