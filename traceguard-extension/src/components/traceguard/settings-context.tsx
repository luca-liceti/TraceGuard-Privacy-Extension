import React, { createContext, useContext, useState, ReactNode } from "react"
import { SettingsModal } from "./settings-modal"

interface SettingsContextType {
    isSettingsOpen: boolean
    setSettingsOpen: (isOpen: boolean) => void
}

const SettingsContext = createContext<SettingsContextType>({
    isSettingsOpen: false,
    setSettingsOpen: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [isSettingsOpen, setSettingsOpen] = useState(false)

    return (
        <SettingsContext.Provider value={{ isSettingsOpen, setSettingsOpen }}>
            {children}
            <SettingsModal />
        </SettingsContext.Provider>
    )
}

export const useSettingsModal = () => useContext(SettingsContext)
