type AuthMessage = { type: "logout" } | { type: "login" }

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null
  if (!channel) {
    channel = new BroadcastChannel("piece_auth")
  }
  return channel
}

export function broadcastLogout() {
  getChannel()?.postMessage({ type: "logout" } satisfies AuthMessage)
}

export function broadcastLogin() {
  getChannel()?.postMessage({ type: "login" } satisfies AuthMessage)
}

export function onAuthMessage(callback: (msg: AuthMessage) => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}

  const handler = (event: MessageEvent<AuthMessage>) => {
    callback(event.data)
  }

  ch.addEventListener("message", handler)
  return () => ch.removeEventListener("message", handler)
}
