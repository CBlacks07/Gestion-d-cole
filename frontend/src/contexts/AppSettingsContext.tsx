import { createContext, useContext, useEffect, useState } from 'react'

export interface AppSettings {
  appName: string
  appTagline: string
  darkMode: boolean
  logoUrl: string
}

const STORAGE_KEY = 'app:settings:v1'

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'SchoolTogo',
  appTagline: 'Système Togolais',
  darkMode: false,
  logoUrl: '/logo.png',
}

function applyDarkMode(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

interface AppSettingsContextValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  toggleDarkMode: () => void
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  toggleDarkMode: () => {},
})

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  useEffect(() => {
    applyDarkMode(settings.darkMode)
  }, [settings.darkMode])

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const toggleDarkMode = () => {
    setSettings(prev => {
      const next = { ...prev, darkMode: !prev.darkMode }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, toggleDarkMode }}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  return useContext(AppSettingsContext)
}
