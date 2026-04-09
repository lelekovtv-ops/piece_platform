/**
 * useCollaboration — connects WS client to auth store and project.
 * Mount at layout level. Handles connect/disconnect lifecycle.
 * Handles token expiration and automatic reconnection.
 */

import { useEffect, useRef, useCallback } from "react"
import { useAuthStore } from "@/lib/auth/auth-store"
import { getAccessToken, refreshApi, setAccessToken } from "@/lib/auth/auth-client"
import { getWSClient } from "@/lib/ws/client"
import { handleServerMessage } from "@/lib/ws/opApplier"
import { useCollaborationStore } from "@/store/collaboration"
import { useProjectsStore } from "@/store/projects"

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]

export function useCollaboration() {
  const { user, isAuthenticated } = useAuthStore()
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const setConnectionState = useCollaborationStore((s) => s.setConnectionState)
  const unsubRef = useRef<(() => void) | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reconnect = useCallback(async () => {
    const result = await refreshApi()
    if (!result) return

    setAccessToken(result.accessToken)
    const client = getWSClient()
    client.connect(result.accessToken)
    reconnectAttemptRef.current = 0
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return
    const attempt = reconnectAttemptRef.current
    const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)]
    reconnectAttemptRef.current = attempt + 1

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      reconnect()
    }, delay)
  }, [reconnect])

  useEffect(() => {
    if (!isAuthenticated || !user) return

    const client = getWSClient()

    if (!unsubRef.current) {
      unsubRef.current = client.onMessage((msg) => {
        handleServerMessage(msg)

        if (msg.type === "auth:ok") {
          setConnectionState(true, true)
          reconnectAttemptRef.current = 0
          client.flushQueue()
        }
        if (msg.type === "auth:error") {
          setConnectionState(true, false)
        }
        if (msg.type === "token_expired") {
          setConnectionState(false, false)
          scheduleReconnect()
        }
      })
    }

    const onDisconnect = () => {
      setConnectionState(false, false)
      if (isAuthenticated) {
        scheduleReconnect()
      }
    }

    const unsubDisconnect = client.onDisconnect(onDisconnect)

    const token = getAccessToken()
    if (token) {
      client.connect(token)
    }

    return () => {
      unsubDisconnect()
    }
  }, [isAuthenticated, user, setConnectionState, scheduleReconnect])

  useEffect(() => {
    if (!isAuthenticated) return

    const client = getWSClient()
    if (activeProjectId) {
      client.joinProject(activeProjectId)
    } else {
      client.leaveProject()
    }
  }, [activeProjectId, isAuthenticated])

  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      getWSClient().disconnect()
      setConnectionState(false, false)
    }
  }, [setConnectionState])
}
