import { User } from './user'

export interface Message {
  id: string;
  text: string;
  sent_at: string;
  author: User;
}

export function createMessage(streamID: string, text: string): Promise<Message> {
  return new Promise<Message>((resolve: Function, reject: Function) => {
    fetch('/api/streams/' + streamID + '/messages', { method: 'POST', body: JSON.stringify({ text }) })
      .then(async (rsp) => {
        const body = await rsp.json()
        rsp.status === 201 ? resolve(body) : reject(body.error || rsp.statusText);
      })
      .catch(err => reject(err))
  })
}

export function fetchMessage(streamID: string): Promise<Message[]> {
  return new Promise<Message[]>((resolve: Function, reject: Function) => {
    fetch('/api/streams/' + streamID + '/messages', { method: 'GET' })
      .then(async (rsp) => {
        const body = await rsp.json()
        rsp.status === 200 ? resolve(body) : reject(body.error || rsp.statusText);
      })
      .catch(err => reject(err))
  })
}
