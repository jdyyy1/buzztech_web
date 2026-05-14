import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

export function useSystemConfig() {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return

    // Listen to the system_config/app_configuration document
    const unsub = onSnapshot(doc(db, "system_config", "app_configuration"), (doc) => {
      if (doc.exists()) {
        setMaintenanceMode(doc.data().maintenanceModeEnabled || false)
      }
      setLoading(false)
    })

    return () => unsub()
  }, [])

  return { maintenanceMode, loading }
}

