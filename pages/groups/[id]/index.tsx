// Frameworks
import { de } from 'date-fns/esm/locale'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

// Components
import ChatUI from '../../../components/chat'
import Layout from '../../../components/layout'

// Utilities
import { createThread, useGroup } from '../../../lib/group'
import { createInvite, useInvites } from '../../../lib/invites'
import { Message } from '../../../lib/message'
import { setSeen } from '../../../lib/seen'

// Styling
import styles from './index.module.scss'

interface Chat {
  type: string
  id: string
}

export default function Group(props) {
  const router = useRouter()
  const groupLoader = useGroup(router.query.id as string)
  const invitesLoader = useInvites(router.query.id as string)
  const [chat, setChat] = useState<Chat>()

  // todo: improve error handling
  if(groupLoader.error || invitesLoader.error) {
    router.push('/error')
    return <div />
  }

  function setChatWrapped(type: string, id: string) {
    if(type === 'thread') {
      let threads = [...groupLoader.group.threads]
      threads.find(t => t.id === id).last_seen = Date.now().toString()
      groupLoader.mutate({ ...groupLoader.group, threads }, false)
    } else if(type === 'chat') {
      let members = [...groupLoader.group.members]
      members.find(t => t.id === id).chat = { 
        ...(members.find(t => t.id === id).chat || {}),
        last_seen: Date.now().toString(),
      }
      groupLoader.mutate({ ...groupLoader.group, members }, false)
    }

    setSeen(type, id)
    setChat({ type, id })
  }

  // default to the first chat
  console.log(chat, groupLoader?.group?.threads?.length)
  if(chat === undefined && (groupLoader.group?.threads?.length || 0) > 0) {
    setChatWrapped('thread', groupLoader.group.threads[0].id)
  }

  let messages = []
  let participants = []
  if(chat?.type === 'thread') {
    messages = groupLoader?.group?.threads?.find(s => s.id === chat.id)?.messages || []
    participants = groupLoader?.group?.members || []
  } else if(chat?.type === 'chat') {
    messages = groupLoader?.group?.members?.find(s => s.id === chat.id)?.chat?.messages || []
    participants = groupLoader.group.members.filter(m => m.id === chat.id || m.current_user)
  }

  async function createChannel() {
    var channel = window.prompt("Enter a new room name")
    if(!channel.length) return

    try {
      const thread = await createThread(router.query.id as string, channel)
      console.log(thread)
      groupLoader.mutate({ ...groupLoader.group!, threads: [...groupLoader.group!.threads, thread] })
      setChat({ type: 'thread', id: thread.id })
    } catch (error) {
      alert(`Error creating channel ${channel}: ${error}`)
    }

  }

  async function sendInvite() {
    var email = window.prompt("Enter the email address of the user you want to invite")
    if(!email.length) return

    try {
      await createInvite(router.query.id as string, email)
      alert(`Invite sent to ${email}`)
    } catch (error) {
      alert(`Error sending invite to ${email}: ${error}`)
    }
  }

  function showMsgIndicator(type: string, id: string): boolean {
    let resource: { messages?: Message[], last_seen?: string | number }

    if(type === 'chat') {
      resource = groupLoader.group.members.find(t => t.id === id)?.chat
    } else if(type === 'thread') {
      resource = groupLoader.group.threads.find(t => t.id === id)
    }

    if(chat?.type === type && chat?.id === id) return false
    if(!resource?.messages?.length) return false
    if(!resource.last_seen) return true

    const lastSeen = Date.parse(resource.last_seen as string)
    let showIndicator = false
    resource.messages.filter(m => !m.author?.current_user).forEach(msg => {
      const sentAt = Date.parse(msg.sent_at as string)
      if(sentAt > lastSeen) showIndicator = true
    })
    return showIndicator
  }

  return <Layout overrideClassName={styles.container} loading={groupLoader.loading || invitesLoader.loading}>
    <div className={styles.sidebar}>
      <h1>{groupLoader.group?.name}</h1>

      <Link href='/'>
        <div className={styles.goback}>
          <img src='/back.png' alt='Go back' />
          <p>Go back</p>
        </div>
      </Link>

      <div className={styles.section}>
        <h3><span>🛋️</span> Rooms</h3>
        <ul>
          { groupLoader.group?.threads?.map(s => {
            const onClick = () => setChatWrapped('thread', s.id)
            const className = chat?.type === 'thread' && chat?.id === s.id ? styles.linkActive : null
            return <li className={className} onClick={onClick} key={s.id}>
              <p>{s.topic}</p>
              { showMsgIndicator('thread', s.id) ? <div className={styles.msgIndicator} /> : null }
            </li>
          })}
          <li key='invite' onClick={createChannel}>New Room</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3><span>👨‍👩‍👦</span> People</h3>
        <ul>
          { groupLoader.group?.members?.filter(u => !u.current_user)?.map(m => {
            const onClick = () => setChatWrapped('chat', m.id)
            const className = chat?.type === 'chat' && chat?.id === m.id ? styles.linkActive : null            
            return <li key={m.id} className={className} onClick={onClick}>
              <p>{m.first_name} {m.last_name}</p>
              { showMsgIndicator('chat', m.id) ? <div className={styles.msgIndicator} /> : null }
            </li>
          })}
          <li key='invite' onClick={sendInvite}>Send Invite</li>
        </ul>
      </div>
    </div>

    { chat ? <ChatUI
                key={chat.id}
                callsEnabled={chat.type === 'thread'}
                chatType={chat.type}
                chatID={chat.id}
                messages={messages}
                participants={participants} /> : null }
 </Layout> 
}
