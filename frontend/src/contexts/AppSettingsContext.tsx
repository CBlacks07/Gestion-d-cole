import { createContext, useContext, useEffect, useState } from 'react'

export interface ColorTheme {
  id: string
  label: string
  swatch: string
  shades: Record<number, string>
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'green', label: 'Vert', swatch: '#16a34a',
    shades: {
      50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
      400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
      800: '#166534', 900: '#14532d',
    },
  },
  {
    id: 'blue', label: 'Bleu', swatch: '#2563eb',
    shades: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
      800: '#1e40af', 900: '#1e3a8a',
    },
  },
  {
    id: 'violet', label: 'Violet', swatch: '#7c3aed',
    shades: {
      50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
      400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
      800: '#5b21b6', 900: '#4c1d95',
    },
  },
  {
    id: 'indigo', label: 'Indigo', swatch: '#4f46e5',
    shades: {
      50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
      400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
      800: '#3730a3', 900: '#312e81',
    },
  },
  {
    id: 'orange', label: 'Orange', swatch: '#ea580c',
    shades: {
      50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
      400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
      800: '#9a3412', 900: '#7c2d12',
    },
  },
  {
    id: 'rose', label: 'Rose', swatch: '#e11d48',
    shades: {
      50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
      400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
      800: '#9f1239', 900: '#881337',
    },
  },
]

function buildThemeCSS(s: Record<number, string>): string {
  return `
/* backgrounds */
.bg-primary-50{background-color:${s[50]}!important}
.bg-primary-100{background-color:${s[100]}!important}
.bg-primary-200{background-color:${s[200]}!important}
.bg-primary-300{background-color:${s[300]}!important}
.bg-primary-400{background-color:${s[400]}!important}
.bg-primary-500{background-color:${s[500]}!important}
.bg-primary-600{background-color:${s[600]}!important}
.bg-primary-700{background-color:${s[700]}!important}
.bg-primary-800{background-color:${s[800]}!important}
.bg-primary-900{background-color:${s[900]}!important}
/* hover backgrounds */
.hover\\:bg-primary-50:hover{background-color:${s[50]}!important}
.hover\\:bg-primary-100:hover{background-color:${s[100]}!important}
.hover\\:bg-primary-600:hover{background-color:${s[600]}!important}
.hover\\:bg-primary-700:hover{background-color:${s[700]}!important}
/* group-hover backgrounds */
.group:hover .group-hover\\:bg-primary-600{background-color:${s[600]}!important}
.group:hover .group-hover\\:bg-primary-700{background-color:${s[700]}!important}
/* text */
.text-primary-50{color:${s[50]}!important}
.text-primary-100{color:${s[100]}!important}
.text-primary-200{color:${s[200]}!important}
.text-primary-300{color:${s[300]}!important}
.text-primary-600{color:${s[600]}!important}
.text-primary-700{color:${s[700]}!important}
.text-primary-800{color:${s[800]}!important}
.hover\\:text-primary-600:hover{color:${s[600]}!important}
.hover\\:text-primary-700:hover{color:${s[700]}!important}
.group:hover .group-hover\\:text-white{color:#fff!important}
/* borders */
.border-primary-200{border-color:${s[200]}!important}
.border-primary-300{border-color:${s[300]}!important}
.border-primary-500{border-color:${s[500]}!important}
.border-primary-600{border-color:${s[600]}!important}
.border-primary-700{border-color:${s[700]}!important}
/* rings */
.ring-primary-300{--tw-ring-color:${s[300]}!important}
.ring-primary-500{--tw-ring-color:${s[500]}!important}
.focus\\:ring-primary-500:focus{--tw-ring-color:${s[500]}!important}
.focus\\:border-primary-500:focus{border-color:${s[500]}!important}
/* gradients */
.from-primary-500{--tw-gradient-from:${s[500]}!important}
.from-primary-600{--tw-gradient-from:${s[600]}!important}
.to-primary-600{--tw-gradient-to:${s[600]}!important}
.to-primary-700{--tw-gradient-to:${s[700]}!important}
.to-primary-800{--tw-gradient-to:${s[800]}!important}
`
}

function applyTheme(themeId: string) {
  const theme = COLOR_THEMES.find(t => t.id === themeId) ?? COLOR_THEMES[0]
  const styleId = '__app-theme__'
  let el = document.getElementById(styleId) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = styleId
    document.head.appendChild(el)
  }
  el.textContent = buildThemeCSS(theme.shades)
}

export interface AppSettings {
  appName: string
  appTagline: string
  themeId: string
  darkMode: boolean
  logoUrl: string
}

const STORAGE_KEY = 'app:settings:v1'

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'Gestion École',
  appTagline: 'Système Togolais',
  themeId: 'green',
  darkMode: false,
  logoUrl: '',
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
    if (settings.themeId !== 'green') {
      applyTheme(settings.themeId)
    }
  }, [settings.themeId])

  useEffect(() => {
    applyDarkMode(settings.darkMode)
  }, [settings.darkMode])

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      if (patch.themeId) {
        if (patch.themeId === 'green') {
          const el = document.getElementById('__app-theme__')
          if (el) el.remove()
        } else {
          applyTheme(patch.themeId)
        }
      }
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
