"use client"

import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Settings */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-6">Profile Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Admin Name</label>
            <input
              type="text"
              placeholder="Enter name"
              className="w-full mt-2 px-4 py-2 border border-border rounded-md"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              placeholder="Enter email"
              className="w-full mt-2 px-4 py-2 border border-border rounded-md"
            />
          </div>
          <Button>Save Changes</Button>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-6">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive email updates</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">SMS Notifications</p>
              <p className="text-sm text-muted-foreground">Receive SMS updates</p>
            </div>
            <Switch />
          </div>
        </div>
      </Card>
    </div>
  )
}
