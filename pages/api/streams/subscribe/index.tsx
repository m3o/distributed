import { NextApiRequest, NextApiResponse } from 'next'
import { BaseURL, APIKey } from '../../../../lib/micro'
import WebSocket from 'ws'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return new Promise((resolve) => {
    var wsToMicro = null
    let connectionClosed = false
    const wss = new WebSocket.Server({ noServer: true })
    wss.on('error', (error) => {
      console.error('connection error to client ' + JSON.stringify(error))
      if (wsToMicro) {
        wsToMicro.close()
      }
      if (wss) {
        wss.close()
      }
    })
    wss.on('close', () => {
      console.log('websocket to client closed')
      connectionClosed = true
      if (wsToMicro) {
        wsToMicro.close()
      }
    })
    wss.on('connection', (wss, req1) => {
      wss.on('message', (data) => {
        // set up connection to micro
        wsToMicro = new WebSocket(
          BaseURL.replace('http', 'ws') + '/v1/streams/subscribe',
          [],
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + APIKey,
            },
          }
        )
        wsToMicro.on('error', (error) => {
          console.error('connection error to micro ' + JSON.stringify(error))
          if (wsToMicro) {
            wsToMicro.close()
          }
          if (wss) {
            wss.close()
          }
        })
        wsToMicro.on('close', () => {
          wss.close()
        })
        wsToMicro.on('open', () => {
          try {
            wsToMicro.send(data)
          } catch (e) {
            console.error(
              'Error while sending data to micro ' + JSON.stringify(e)
            )
          }
        })
        wsToMicro.on('message', (data) => {
          try {
            wss.send(data)
          } catch (e) {
            console.error(
              'Error while sending data to client ' + JSON.stringify(e)
            )
          }
        })
      })
      wss.on('close', () => {
        console.log('upgraded websocket to client closed')
        connectionClosed = true
        if (wsToMicro) {
          wsToMicro.close()
        }
      })
    })

    wss.handleUpgrade(req, req.socket, req.headers, (wssInput) => {
      wssInput.on('error', (error) => {
        console.error(
          'connection error on upgraded socket ' + JSON.stringify(error)
        )
        if (wsToMicro) {
          wsToMicro.close()
        }
        if (wss) {
          wss.close()
        }
      })
      wss.emit('connection', wssInput, req)
    })

    function checkClosed() {
      if (connectionClosed) {
        resolve(null)
        return
      }
      setTimeout(checkClosed, 5000)
    }
    checkClosed()
  })
}
