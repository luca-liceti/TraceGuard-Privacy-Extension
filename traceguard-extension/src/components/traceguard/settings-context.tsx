import React, { createContext, useContext, useState, ReactNode } from "react"


interface SettingsContextType {
    isSettingsOpen: boolean
    setSettingsOpen: (isOpen: boolean) => void
    activeTab: string
    setActiveTab: (tab: string) => void
}

const SettingsContext = createContext<SettingsContextType>({
    isSettingsOpen: false,
    setSettingsOpen: () => {},
    activeTab: "appearance",
    setActiveTab: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("appearance")

    return (
        <SettingsContext.Provider value={{ isSettingsOpen, setSettingsOpen, activeTab, setActiveTab }}>
            {children}
        </SettingsContext.Provider>
    )
}

export const useSettingsModal = () => useContext(SettingsContext)
