"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Loader2, 
  Moon, 
  Sun, 
  ShieldAlert, 
  User, 
  Palette, 
  Lock,
} from "lucide-react"

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [systemConfig, setSystemConfig] = useState({
    maintenanceModeEnabled: false,
    maintenanceModeMessage: "",
    appLabel: "BUZZ TECH",
    allowNewRegistrations: true,
  })

  // 1. Real-time Firestore Sync for Maintenance Mode
  useEffect(() => {
    if (!db || !user) {
      setLoading(false)
      return
    }

    const docRef = doc(db, "system_config", "app_configuration")
    const unsub = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setSystemConfig(doc.data() as any)
      }
      setLoading(false)
    }, (error) => {
      console.error("Firestore sync error:", error)
      setLoading(false)
    })

    return () => unsub()
  }, [user])

  const handleUpdateConfig = async (updates: Partial<typeof systemConfig>) => {
    if (user?.role !== "superadmin") return
    
    setSaving(true)
    try {
      const docRef = doc(db, "system_config", "app_configuration")
      await updateDoc(docRef, updates)
      toast({ title: "Settings updated", description: "System configuration saved successfully." })
    } catch (error) {
      toast({ 
        title: "Update failed", 
        description: "You might not have permission to modify system settings.",
        variant: "destructive" 
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and platform configuration.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> Profile</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2"><Palette className="w-4 h-4" /> Appearance</TabsTrigger>
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <TabsTrigger value="system" className="gap-2"><ShieldAlert className="w-4 h-4" /> System</TabsTrigger>
          )}
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Update your personal details and how others see you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input defaultValue={user?.name} />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input value={user?.email} disabled className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <div className="capitalize font-medium text-primary px-3 py-1 bg-primary/10 rounded-md w-fit">
                  {user?.role}
                </div>
              </div>
              <Button>Save Profile</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme State Management */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Theme Colors</CardTitle>
              <CardDescription>Switch between light and dark modes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark interface.</p>
                </div>
                <div className="flex items-center gap-4">
                  <Sun className={`h-5 w-5 ${theme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <Switch 
                    checked={theme === "dark"} 
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} 
                  />
                  <Moon className={`h-5 w-5 ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Mode & Role-based Logic */}
        <TabsContent value="system">
          <div className="space-y-6">
            {user?.role === "superadmin" ? (
              <>
                <Card className="border-destructive/50">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="bg-destructive/10 p-2 rounded-full">
                      <ShieldAlert className="w-6 h-6 text-destructive" />
                    </div>
                    <div>
                      <CardTitle>Maintenance Mode</CardTitle>
                      <CardDescription>Restrict access to the application during updates.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="m-mode">Enable Maintenance</Label>
                      <Switch 
                        id="m-mode"
                        checked={systemConfig.maintenanceModeEnabled}
                        onCheckedChange={(val) => handleUpdateConfig({ maintenanceModeEnabled: val })}
                        disabled={saving}
                      />
                    </div>
                    {systemConfig.maintenanceModeEnabled && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <Label>Maintenance Message</Label>
                        <Textarea 
                          value={systemConfig.maintenanceModeMessage}
                          onChange={(e) => setSystemConfig({...systemConfig, maintenanceModeMessage: e.target.value})}
                          placeholder="System is undergoing maintenance..."
                        />
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleUpdateConfig({ maintenanceModeMessage: systemConfig.maintenanceModeMessage })}
                          disabled={saving}
                        >
                          Update Message
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Global Branding</CardTitle>
                    <CardDescription>Update application-wide labels.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>App Name</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={systemConfig.appLabel}
                          onChange={(e) => setSystemConfig({...systemConfig, appLabel: e.target.value})}
                        />
                        <Button onClick={() => handleUpdateConfig({ appLabel: systemConfig.appLabel })} disabled={saving}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-muted/50">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <Lock className="w-12 h-12 text-muted-foreground" />
                  <div className="space-y-1">
                    <h3 className="font-bold">Restricted Access</h3>
                    <p className="text-sm text-muted-foreground maximal-w-[300px]">
                      Only Superadmins can modify system-wide configurations and maintenance mode.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}


