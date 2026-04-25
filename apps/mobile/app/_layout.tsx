import { Tabs } from 'expo-router'
import { StyleSheet, Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@media-upload/core'
import { UploadManagerProvider } from '@/lib/upload-manager-context'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <UploadManagerProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: '#94A3B8', // slate-400 — structural
            tabBarLabelStyle: styles.tabLabel,
            tabBarItemStyle: styles.tabItem,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Upload',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="cloud-upload-outline" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="history"
            options={{
              title: 'History',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="time-outline" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </UploadManagerProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 24,
    height: 64,
    backgroundColor: colors.white,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    paddingBottom: Platform.OS === 'ios' ? 0 : 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabItem: {
    paddingTop: 6,
  },
})
