"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import { doc, onSnapshot, collection, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  Loader2, 
  Moon, 
  Sun, 
  ShieldAlert, 
  User, 
  Palette, 
  Lock,
  Bell,
  Shield,
  Trash2,
  LogOut,
  Clock,
  Key,
  Eye,
  EyeOff,
  Check,
  Upload,
} from "lucide-react"

// Validation utilities
const validatePassword = (password: string) => password.length >= 8
const validateName = (name: string) => name.trim().length > 0

// API call helper
async function callSettingsAPI(action: string, data: any) {
  const response = await fetch("/api/user/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Settings update failed")
  }
  
  return response.json()
}

export default function SettingsPage() {
  const { user, logout, firebaseUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [editedName, setEditedName] = useState(user?.name || "")
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" })
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  // Notification preferences state
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: false,
    weeklyDigest: true,
    marketingEmails: false,
  })
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  
  // Activity data
  const [activityLogs, setActivityLogs] = useState<Array<{ action: string; timestamp: any }>>([])
  
  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; createdAt: any; lastUsedAt: any; status: string }>>([])
  
  // System config
  const [systemConfig, setSystemConfig] = useState({
    maintenanceModeEnabled: false,
    maintenanceModeMessage: "",
    appLabel: "BUZZ TECH",
    allowNewRegistrations: true,
  })

  // Load initial data
  useEffect(() => {
    if (!db || !user) {
      setLoading(false)
      return
    }

    const initializeSettings = async () => {
      try {
        // Load system config for superadmins
        const docRef = doc(db, "system_config", "app_configuration")
        const unsubSystem = onSnapshot(docRef, (doc) => {
          if (doc.exists()) {
            setSystemConfig(doc.data() as any)
          }
        })

        // Load user preferences
        const userPrefsSnap = await getDocs(collection(db, "users", user.user_id, "preferences"))
        if (userPrefsSnap.docs.length > 0) {
          const prefs = userPrefsSnap.docs[0].data()
          setNotifications(prefs.notifications || notifications)
          setTwoFactorEnabled(prefs.twoFactorEnabled || false)
        }

        // Load API keys
        const keysSnap = await getDocs(collection(db, "users", user.user_id, "apiKeys"))
        setApiKeys(keysSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)))

        // Load activity logs
        const activitySnap = await getDocs(collection(db, "users", user.user_id, "activityLogs"))
        setActivityLogs(activitySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)))

        setLoading(false)
        return unsubSystem
      } catch (error: any) {
        console.error("[v0] Error loading settings:", error.message)
        setLoading(false)
      }
    }

    const unsubPromise = initializeSettings()
    return () => {
      unsubPromise.then(unsub => unsub && unsub())
    }
  }, [user])

  // Handle profile update
  const handleProfileSave = async () => {
    if (!firebaseUser || !user) {
      toast({ title: "Error", description: "User not authenticated", variant: "destructive" })
      return
    }

    if (!validateName(editedName)) {
      toast({ title: "Error", description: "Please enter a valid name", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      await callSettingsAPI("updateProfile", { name: editedName })
      toast({ title: "Success", description: "Profile updated successfully" })
      setProfileEditing(false)
      // Log activity
      await callSettingsAPI("logActivity", { action: "Updated profile" })
    } catch (error: any) {
      console.error("[v0] Profile update error:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Handle password change
  const handlePasswordChange = async () => {
    if (!firebaseUser || !firebaseUser.email) {
      toast({ title: "Error", description: "User not authenticated", variant: "destructive" })
      return
    }

    if (!passwordForm.current) {
      toast({ title: "Error", description: "Please enter your current password", variant: "destructive" })
      return
    }

    if (!validatePassword(passwordForm.new)) {
      toast({ title: "Error", description: "New password must be at least 8 characters", variant: "destructive" })
      return
    }

    if (passwordForm.new !== passwordForm.confirm) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" })
      return
    }

    setPasswordLoading(true)
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, passwordForm.current)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updatePassword(firebaseUser, passwordForm.new)
      
      toast({ title: "Success", description: "Password updated successfully" })
      setPasswordForm({ current: "", new: "", confirm: "" })
      await callSettingsAPI("logActivity", { action: "Changed password" })
    } catch (error: any) {
      console.error("[v0] Password change error:", error)
      toast({ 
        title: "Error", 
        description: error.code === "auth/wrong-password" ? "Current password is incorrect" : error.message,
        variant: "destructive" 
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  // Handle notification preferences save
  const handleSaveNotifications = async () => {
    if (!user) return

    setNotificationsLoading(true)
    try {
      await callSettingsAPI("updateNotifications", { notifications })
      toast({ title: "Success", description: "Notification preferences saved" })
      await callSettingsAPI("logActivity", { action: "Updated notification preferences" })
    } catch (error: any) {
      console.error("[v0] Notification update error:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setNotificationsLoading(false)
    }
  }

  // Handle 2FA toggle
  const handleToggle2FA = async (enabled: boolean) => {
    if (!user) return

    setTwoFactorLoading(true)
    try {
      await callSettingsAPI("toggle2FA", { enabled })
      setTwoFactorEnabled(enabled)
      toast({ title: "Success", description: `Two-factor authentication ${enabled ? "enabled" : "disabled"}` })
      await callSettingsAPI("logActivity", { action: `${enabled ? "Enabled" : "Disabled"} 2FA` })
    } catch (error: any) {
      console.error("[v0] 2FA toggle error:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setTwoFactorLoading(false)
    }
  }

  // Handle API key revocation
  const handleRevokeApiKey = async (keyId: string) => {
    if (!user) return

    try {
      await callSettingsAPI("revokeApiKey", { keyId })
      setApiKeys(apiKeys.filter(k => k.id !== keyId))
      toast({ title: "Success", description: "API key revoked" })
      await callSettingsAPI("logActivity", { action: "Revoked API key" })
    } catch (error: any) {
      console.error("[v0] Revoke API key error:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  // Handle generate new API key
  const handleGenerateApiKey = async () => {
    if (!user) return

    setSaving(true)
    try {
      await callSettingsAPI("generateApiKey", {})
      toast({ title: "Success", description: "API key generated" })
      // Reload keys
      const keysSnap = await getDocs(collection(db, "users", user.user_id, "apiKeys"))
      setApiKeys(keysSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)))
      await callSettingsAPI("logActivity", { action: "Generated new API key" })
    } catch (error: any) {
      console.error("[v0] Generate API key error:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Handle system config update
  const handleUpdateConfig = async (updates: Partial<typeof systemConfig>) => {
    if (user?.role !== "superadmin") return
    
    setSaving(true)
    try {
      const response = await fetch("/api/system/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
      
      if (!response.ok) throw new Error("Failed to update")
      
      setSystemConfig(prev => ({ ...prev, ...updates }))
      toast({ title: "Success", description: "System configuration updated" })
    } catch (error: any) {
      console.error("[v0] System config error:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Format timestamp for display
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "Never"
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return "Never"
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account, preferences, and system configuration.</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid grid-cols-2 lg:grid-cols-6 w-full lg:w-auto">
            <TabsTrigger value="profile" className="gap-2 text-xs lg:text-sm"><User className="w-4 h-4" /><span className="hidden sm:inline">Profile</span></TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2 text-xs lg:text-sm"><Palette className="w-4 h-4" /><span className="hidden sm:inline">Appearance</span></TabsTrigger>
            <TabsTrigger value="security" className="gap-2 text-xs lg:text-sm"><Shield className="w-4 h-4" /><span className="hidden sm:inline">Security</span></TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 text-xs lg:text-sm"><Bell className="w-4 h-4" /><span className="hidden sm:inline">Notifications</span></TabsTrigger>
            <TabsTrigger value="activity" className="gap-2 text-xs lg:text-sm"><Clock className="w-4 h-4" /><span className="hidden sm:inline">Activity</span></TabsTrigger>
            {user?.role === "superadmin" && (
              <TabsTrigger value="system" className="gap-2 text-xs lg:text-sm"><ShieldAlert className="w-4 h-4" /><span className="hidden sm:inline">System</span></TabsTrigger>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Account Profile</CardTitle>
                <CardDescription>Manage your personal information and profile details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="space-y-4 pb-6 border-b">
                  <Label className="text-base font-semibold">Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-white text-2xl font-bold">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photo
                      </Button>
                      <Button variant="ghost" size="sm" disabled>Remove</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Photo upload coming soon</p>
                  </div>
                </div>

                {/* Account Information */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Account Information</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullname" className="text-sm">Full Name</Label>
                      <Input 
                        id="fullname" 
                        value={editedName} 
                        onChange={(e) => setEditedName(e.target.value)}
                        disabled={!profileEditing || saving} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm">Email Address</Label>
                      <Input id="email" value={user?.email} disabled className="bg-muted" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm">Role</Label>
                    <div className="flex items-center gap-2">
                      <div className="capitalize font-medium text-primary px-4 py-2 bg-primary/10 rounded-lg w-fit flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        {user?.role}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => {
                      if (profileEditing) {
                        setEditedName(user?.name || "")
                      }
                      setProfileEditing(!profileEditing)
                    }}
                    variant={profileEditing ? "outline" : "default"}
                    disabled={saving}
                  >
                    {profileEditing ? "Cancel" : "Edit Profile"}
                  </Button>
                  {profileEditing && (
                    <Button 
                      onClick={handleProfileSave}
                      disabled={saving || !editedName.trim() || editedName === user?.name}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Changes
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Delete Account */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions that affect your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-2">
                      <Trash2 className="w-4 h-4" /> Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All your data will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-2 justify-end">
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-white">Delete</AlertDialogAction>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sun className="w-5 h-5" /> Theme Settings</CardTitle>
                <CardDescription>Customize how the application looks for you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dark Mode Toggle */}
                <div className="space-y-4 pb-6 border-b">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">Toggle between light and dark interface.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Sun className={`h-5 w-5 transition-colors ${theme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Switch 
                        checked={theme === "dark"} 
                        onCheckedChange={(checked) => {
                          setTheme(checked ? "dark" : "light")
                          toast({ title: "Theme updated", description: `Switched to ${checked ? "dark" : "light"} mode.` })
                        }} 
                      />
                      <Moon className={`h-5 w-5 transition-colors ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Security & Authentication</CardTitle>
                <CardDescription>Manage your password, two-factor authentication, and API keys.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Password Change */}
                <div className="space-y-4 pb-6 border-b">
                  <Label className="text-base font-semibold">Change Password</Label>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="current-pwd" className="text-sm">Current Password</Label>
                      <Input 
                        id="current-pwd" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                        disabled={passwordLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-pwd" className="text-sm">New Password</Label>
                      <Input 
                        id="new-pwd" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                        disabled={passwordLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-pwd" className="text-sm">Confirm Password</Label>
                      <Input 
                        id="confirm-pwd" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                        disabled={passwordLoading}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setShowPassword(!showPassword)}
                        className="gap-2"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    size="sm"
                    onClick={handlePasswordChange}
                    disabled={passwordLoading || !passwordForm.current || !passwordForm.new || !passwordForm.confirm}
                  >
                    {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Update Password
                  </Button>
                </div>

                {/* Two-Factor Authentication */}
                <div className="space-y-4 pb-6 border-b">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${twoFactorEnabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {twoFactorEnabled ? "Enabled" : "Disabled"}
                      </div>
                      <Switch 
                        checked={twoFactorEnabled} 
                        onCheckedChange={handleToggle2FA}
                        disabled={twoFactorLoading}
                      />
                    </div>
                  </div>
                </div>

                {/* API Keys */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">API Keys</Label>
                  <div className="space-y-3">
                    {apiKeys.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No API keys yet. Generate one to get started.</p>
                    ) : (
                      apiKeys.map((key) => (
                        <div key={key.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{key.name}</p>
                            <p className="text-xs text-muted-foreground">Created {formatTime(key.createdAt)} • Last used {formatTime(key.lastUsedAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">{key.status}</span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleRevokeApiKey(key.id)}
                            >
                              Revoke
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleGenerateApiKey}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Generate New Key
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Notification Preferences</CardTitle>
                <CardDescription>Choose how and when you want to be notified.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    { key: "emailNotifications", label: "Email Notifications", description: "Receive email updates about your account" },
                    { key: "pushNotifications", label: "Push Notifications", description: "Get browser push notifications for important events" },
                    { key: "weeklyDigest", label: "Weekly Digest", description: "Receive a summary of activity once a week" },
                    { key: "marketingEmails", label: "Marketing Emails", description: "Stay informed about new features and updates" },
                  ].map((notif) => (
                    <div key={notif.key} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">{notif.label}</Label>
                        <p className="text-xs text-muted-foreground">{notif.description}</p>
                      </div>
                      <Switch 
                        checked={notifications[notif.key as keyof typeof notifications]} 
                        onCheckedChange={(val) => setNotifications({...notifications, [notif.key]: val})}
                        disabled={notificationsLoading}
                      />
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={handleSaveNotifications}
                  disabled={notificationsLoading}
                >
                  {notificationsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Recent Activity</CardTitle>
                <CardDescription>View your recent account activities and access logs.</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activityLogs.slice(0, 10).map((activity, idx) => (
                      <div key={idx} className="flex items-center gap-4 pb-4 border-b last:border-0 last:pb-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{activity.action || "Activity"}</p>
                          <p className="text-xs text-muted-foreground">{formatTime(activity.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          {user?.role === "superadmin" && (
            <TabsContent value="system" className="space-y-6">
              <div className="space-y-6">
                {/* Maintenance Mode */}
                <Card className="border-destructive/50">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="bg-destructive/10 p-3 rounded-full">
                      <ShieldAlert className="w-6 h-6 text-destructive" />
                    </div>
                    <div>
                      <CardTitle>Maintenance Mode</CardTitle>
                      <CardDescription>Restrict access during updates and maintenance.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <Label htmlFor="m-mode" className="font-semibold">Enable Maintenance</Label>
                      <Switch 
                        id="m-mode"
                        checked={systemConfig.maintenanceModeEnabled}
                        onCheckedChange={(val) => handleUpdateConfig({ maintenanceModeEnabled: val })}
                        disabled={saving}
                      />
                    </div>
                    {systemConfig.maintenanceModeEnabled && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-1 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                        <Label htmlFor="m-msg" className="text-sm font-semibold">Maintenance Message</Label>
                        <Textarea 
                          id="m-msg"
                          value={systemConfig.maintenanceModeMessage}
                          onChange={(e) => setSystemConfig({...systemConfig, maintenanceModeMessage: e.target.value})}
                          placeholder="System is undergoing maintenance..."
                          className="resize-none"
                        />
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdateConfig({ maintenanceModeMessage: systemConfig.maintenanceModeMessage })}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Update Message
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Global Branding */}
                <Card className="border border-border/50">
                  <CardHeader>
                    <CardTitle>Global Branding</CardTitle>
                    <CardDescription>Update application-wide labels and branding.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <Label htmlFor="app-name" className="text-sm font-medium">App Name</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="app-name"
                          value={systemConfig.appLabel}
                          onChange={(e) => setSystemConfig({...systemConfig, appLabel: e.target.value})}
                        />
                        <Button onClick={() => handleUpdateConfig({ appLabel: systemConfig.appLabel })} disabled={saving}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Allow New Registrations</Label>
                        <p className="text-xs text-muted-foreground">Enable or disable new user signups.</p>
                      </div>
                      <Switch 
                        checked={systemConfig.allowNewRegistrations}
                        onCheckedChange={(val) => handleUpdateConfig({ allowNewRegistrations: val })}
                        disabled={saving}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Logout Button */}
        <Card className="border border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Session</Label>
                <p className="text-sm text-muted-foreground">Log out of your current session.</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <LogOut className="w-4 h-4" /> Logout
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign Out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be logged out of your account and redirected to the login page.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex gap-2 justify-end">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => logout()}>Sign Out</AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
