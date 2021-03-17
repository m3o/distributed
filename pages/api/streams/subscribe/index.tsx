import {NextApiRequest, NextApiResponse} from 'next'
import {BaseURL, APIKey} from '../../../../lib/micro'
import WebSocket from 'ws';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  var wsToMicro = null


  const wss = new WebSocket.Server({noServer: true});
  wss.on('error', (error) => {
    console.error('connection error to client ' + JSON.stringify(error))
    if (wsToMicro) {
      wsToMicro.close()
    }
    if (wss) {
      wss.close()
    }
  })
  wss.on('connection', (wss, req1) => {
    console.log('Connected to this')
    wss.on('message', (data) => {
      wsToMicro = new WebSocket(BaseURL.replace('http', 'ws') + '/v1/streams/subscribe', [], {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + APIKey
        }
      })
      wsToMicro.on('error', (error) => {
        console.error('connection error to micro ' + JSON.stringify(error))
        if (wsToMicro) {
          wsToMicro.close()
        }
        if (wss) {
          wss.close()
        }
      })

      wsToMicro.on('open', () => {
        wsToMicro.send(data)
      })
      wsToMicro.on('message', (data) => {
        wss.send(data)
      })

    })

  })
  wss.handleUpgrade(req, req.socket, req.headers, (wssInput) => {
    wss.emit('connection', wssInput, req)
  })

}
