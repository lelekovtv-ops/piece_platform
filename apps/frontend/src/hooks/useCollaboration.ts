/**
 * useCollaboration — connects WS client to auth store and project.
 * Mount at layout level. Handles connect/disconnect lifecycle.
 */

import { useEffect, useRef } from "react"
import { useAuthStore } from "@/lib/auth/auth-store"
import { getAccessToken } from "@/lib/auth/auth-client"
import { getWSClient } from "@/lib/ws/client"
import { handleServerMessage } from "@/lib/ws/opApplier"
import { useCollaborationStore } from "@/store/collaboration"
import { useProjectsStore } from "@/store/projects"

export function useCollaboration() {
  const { user, isAuthenticated } = useAuthStore()
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const setConnectionState = useCollaborationStore((s) => s.setConnectionState)
  const unsubRef = useRef<(() => void) | null>(null)

  // Connect when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) return

    const client = getWSClient()

    // Subscribe to messages
    if (!unsubRef.current) {
      unsubRef.current = client.onMessage((msg) => {
        handleServerMessage(msg)

        // Track connection state
        if (msg.type === "auth:ok") {
          setConnectionState(true, true)
          client.flushQueue()
        }
        if (msg.type === "auth:error") {
          setConnectionState(true, false)
        }
      })
    }

    // Get JWT token for WS auth
    const token = getAccessToken()
    if (token) {
      client.connect(token)
    }

    return () => {
      // Don't disconnect on every re-render — only on unmount
    }
  }, [isAuthenticated, user, setConnectionState])

  // Join/leave project
  useEffect(() => {
    if (!isAuthenticated) return

    const client = getWSClient()
    if (activeProjectId) {
      client.joinProject(activeProjectId)
    } else {
      client.leaveProject()
    }
  }, [activeProjectId, isAuthenticated])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      getWSClient().disconnect()
      setConnectionState(false, false)
    }
  }, [setConnectionState])
}
