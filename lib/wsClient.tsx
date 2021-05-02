import { useCallback, useEffect, useRef } from 'react'

const WS_RECONNECT_TIMEOUT_INITIAL = 2 * 1000
const WS_RECONNECT_TIMEOUT_MAX = 5 * 60 * 1000

const calculateTimeout = (prevTimeout) =>
  Math.min(prevTimeout * 2, WS_RECONNECT_TIMEOUT_MAX)

interface WsConfig {
  url: string
  reconnectOnClose?: boolean
  /* eslint-disable no-unused-vars */
  onopen?: (event: Event, ws: WebSocket) => void
  onerror?: (event: Event, ws: WebSocket) => void
  onmessage?: (event: MessageEvent, ws: WebSocket) => void
  onclose?: (event: CloseEvent, ws: WebSocket) => void
  /* eslint-enable no-unused-vars */
}

function useWsClient(
  { url, reconnectOnClose, onopen, onerror, onmessage, onclose }: WsConfig = {
    url: '',
    reconnectOnClose: false,
  }
) {
  const wsClient = useRef<WebSocket>()
  const reconnectTimer = useRef<NodeJS.Timeout>()
  const reconnectTimeout = useRef<number>(WS_RECONNECT_TIMEOUT_INITIAL)

  const connect = useCallback(() => {
    if (
      (!wsClient.current ||
        wsClient.current?.readyState === WebSocket.CLOSED) &&
      url
    ) {
      console.log(`Websocket(${url}): creating...`)
      wsClient.current = new WebSocket(url)
      console.log(`Websocket(${url}): created`)
    }

    if (!wsClient.current) return

    wsClient.current.onopen = (event) => {
      console.log(`Websocket(${url}) connected: ${JSON.stringify(event)}`)
      reconnectTimeout.current = WS_RECONNECT_TIMEOUT_INITIAL
      if (onopen) onopen(event, wsClient.current)
    }

    wsClient.current.onerror = (event) => {
      console.log(`Websocket(${url}) error: ${JSON.stringify(event)}`)
      if (onerror) onerror(event, wsClient.current)
    }

    wsClient.current.onmessage = (event) => {
      console.log(
        `Websocket(${url}) message received: ${JSON.stringify(event)}`
      )
      if (onmessage) onmessage(event, wsClient.current)
    }

    wsClient.current.onclose = (event) => {
      console.log(`Websocket(${url}) closed: ${JSON.stringify(event)}`)
      if (reconnectOnClose) {
        console.log(
          `Websocket(${url}) reconnecting in ${reconnectTimeout.current} ms`
        )
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = setTimeout(connect, reconnectTimeout.current)
        reconnectTimeout.current = calculateTimeout(reconnectTimeout.current)
      }
      if (onclose) onclose(event, wsClient.current)
    }
  }, [url, reconnectOnClose, onclose, onerror, onmessage, onopen])

  const disconnect = useCallback(() => {
    if (wsClient.current && wsClient.current.readyState !== WebSocket.CLOSED) {
      console.log(`Websocket(${url}): closing...`)
      wsClient.current.close()
    }
  }, [url])

  useEffect(() => {
    return () => {
      disconnect()
      clearTimeout(reconnectTimer.current)
    }
  }, [disconnect])

  useEffect(() => {
    connect()
  }, [url, connect])

  return wsClient.current
}

export { useWsClient }
