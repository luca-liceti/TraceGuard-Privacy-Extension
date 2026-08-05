"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { Lock, Key, ShieldCheck, AlertCircle, ShieldAlert, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { deriveKeyFromPassword, generateSalt, exportKey } from "@/lib/crypto"

type AuthState = "loading" | "setup" | "locked" | "unlocked"

interface AuthContextType {
  authState: AuthState
  unlock: (password: string) => Promise<boolean>
  setup: (password: string, name: string) => Promise<boolean>
  lock: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [userName, setUserName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAuth()
    
    // Listen for alarms or messages that might lock the vault
    const listener = (changes: any, namespace: string) => {
      if (namespace === "session" && changes.cryptoKeyHex === undefined) {
        // Key was removed from session (e.g. by auto-lock)
        checkAuth()
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const checkAuth = async () => {
    try {
      const local = await chrome.storage.local.get(["cryptoSalt", "validator"])
      if (!local.cryptoSalt || !local.validator) {
        setAuthState("setup")
        return
      }

      const session = await chrome.storage.session.get("cryptoKeyHex")
      if (session.cryptoKeyHex) {
        setAuthState("unlocked")
      } else {
        setAuthState("locked")
      }
    } catch (err) {
      console.error("Auth check failed:", err)
      setAuthState("setup") // fallback for dev
    }
  }

  const setup = async (pwd: string, name: string) => {
    setLoading(true)
    setError("")
    try {
      // Generate a new salt
      const salt = generateSalt()
      const saltArray = Array.from(salt)
      
      // Derive key
      const key = await deriveKeyFromPassword(pwd, salt)
      const keyHex = await exportKey(key)
      
      // Create a validator hash to check the password later without storing it
      // We'll just encrypt a known string "TraceGuardValidator"
      const encoder = new TextEncoder()
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encryptedValidator = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode("TraceGuardValidator")
      )
      
      const combined = new Uint8Array(iv.length + encryptedValidator.byteLength)
      combined.set(iv, 0)
      combined.set(new Uint8Array(encryptedValidator), iv.length)
      const validatorBase64 = btoa(String.fromCharCode(...combined))

      // Save salt and validator to disk
      await chrome.storage.local.set({ 
        cryptoSalt: saltArray,
        validator: validatorBase64,
        userName: name
      })

      // Save key to memory
      await chrome.storage.session.set({ cryptoKeyHex: keyHex })
      
      setPassword("")
      setConfirmPassword("")
      setAuthState("unlocked")
      return true
    } catch (err: any) {
      setError(err.message || "Setup failed")
      return false
    } finally {
      setLoading(false)
    }
  }

  const unlock = async (pwd: string) => {
    setLoading(true)
    setError("")
    try {
      const local = await chrome.storage.local.get(["cryptoSalt", "validator"])
      const salt = new Uint8Array(local.cryptoSalt)
      
      const key = await deriveKeyFromPassword(pwd, salt)
      
      // Verify password by decrypting the validator
      const binary = atob(local.validator)
      const combined = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i)
      
      const iv = combined.slice(0, 12)
      const ciphertext = combined.slice(12)
      
      try {
        const decryptedBuffer = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          ciphertext
        )
        const decoder = new TextDecoder()
        if (decoder.decode(decryptedBuffer) !== "TraceGuardValidator") {
          throw new Error("Invalid password")
        }
      } catch (e) {
        throw new Error("Invalid password")
      }

      // Valid! Save to session
      const keyHex = await exportKey(key)
      await chrome.storage.session.set({ cryptoKeyHex: keyHex })
      
      // Notify background to flush buffers
      chrome.runtime.sendMessage({ type: "UNLOCK_VAULT" })
      
      setPassword("")
      setAuthState("unlocked")
      return true
    } catch (err: any) {
      setError("Incorrect Master Password")
      return false
    } finally {
      setLoading(false)
    }
  }

  const lock = async () => {
    await chrome.storage.session.remove("cryptoKeyHex")
    setPassword("")
    setAuthState("locked")
  }

  if (authState === "loading") {
    return <div className="flex h-screen items-center justify-center bg-background"><Shield className="h-8 w-8 animate-pulse text-foreground" /></div>
  }

  if (authState === "setup") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex aspect-square size-8 items-center justify-center mx-auto mb-2">
              <Shield className="size-6 text-foreground" />
            </div>
            <CardTitle className="text-xl">Secure Your Vault</CardTitle>
            <CardDescription>
              Create a Master Password to encrypt your privacy logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault()
              if (password !== confirmPassword) {
                setError("Passwords do not match")
                return
              }
              if (password.length < 8) {
                setError("Password must be at least 8 characters")
                return
              }
              if (userName.trim().length === 0) {
                setError("Name is required")
                return
              }
              setup(password, userName.trim())
            }}>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="setup-name">What should we call you?</Label>
                  <Input
                    id="setup-name"
                    type="text"
                    placeholder="Your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="setup-password">Master Password</Label>
                  <Input
                    id="setup-password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="setup-confirm">Confirm Password</Label>
                  <Input
                    id="setup-confirm"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Encrypting..." : "Create Vault"}
                </Button>
              </div>
            </form>
            <div className="mt-4 text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
              By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (authState === "locked") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex aspect-square size-8 items-center justify-center mx-auto mb-2">
              <Shield className="size-6 text-foreground" />
            </div>
            <CardTitle className="text-xl">Vault Locked</CardTitle>
            <CardDescription>
              Enter your Master Password to access your privacy logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault()
              unlock(password)
            }}>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="locked-password">Master Password</Label>
                  <Input
                    id="locked-password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading || !password}>
                  <Key className="mr-2 h-4 w-4" />
                  {loading ? "Unlocking..." : "Unlock Vault"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AuthContext.Provider value={{ authState, unlock, setup, lock }}>{children}</AuthContext.Provider>
}
