// Frameworks
import { group } from 'console'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

// Components
import ChatUI from '../../../components/chat'
import Layout from '../../../components/layout'

// Utilities
import { createThread, deleteThread, leaveGroup, renameGroup, updateThread, useGroup } from '../../../lib/group'
import { createInvite } from '../../../lib/invites'
import { Message } from '../../../lib/message'
import { logout } from '../../../lib/user'

// Styling
import styles from './index.module.scss'

interface Chat {
  type: string
  id: string
}

export async function getServerSideProps(content) {
  const id = content.query.id
  return {props: { id }}
} 

export default function Group(props) {
  const router = useRouter()
  const groupLoader = useGroup(props.id)
  const [chat, setChat] = useState<Chat>()
  const [connected, setConnected] = useState<boolean>(false)
  const [viewSettings, setViewSettings] = useState<boolean>(false)

  // todo: improve error handling
  if(groupLoader.error) {
    router.push('/error')
    return <div />
  }

  if(!connected && groupLoader.group) {
    setConnected(true)

    const w = groupLoader.group.websocket
    var ws = new WebSocket(w.url)

    ws.onopen = function (event) {
      console.log("Websocket opened")
      ws.send(JSON.stringify({ token: w.token, topic: w.topic }))
    }

    ws.onmessage = function ({ data }) {
      // todo: fix duplicate encoding?!
      const event = JSON.parse(data)
      const message = JSON.parse(JSON.parse(event.message))
      
      if(message.group_id && message.group_id !== props.id) {
        console.log("Ignoring message: ", message)
        return
      }

      switch(message.type) {
      case 'group.updated':
        console.log("Group updated:", message)
        groupLoader.mutate({ ...groupLoader.group, ...message })
        break
      case 'group.user.left':
        console.log("User left group:", message)
        groupLoader.mutate({ ...groupLoader.group, members: groupLoader.group.members?.filter(m => m.id !== message.payload.id) }, false)
        break
      case 'group.user.joined':
        console.log("User joined group:", message)
        groupLoader.mutate({ 
          ...groupLoader.group, 
          members: [
            ...groupLoader.group.members,
            message.payload,
          ],
        })
        break
      case 'tread.created':
        console.log("Thread created: ", message)
        groupLoader.mutate({ 
          ...groupLoader.group, 
          threads: [
            ...groupLoader.group.threads,
            message.payload,
          ],
        })
        break
      case 'thread.updated':
        console.log("Thread updated: ", message)
        groupLoader.mutate({
          ...groupLoader.group, 
          threads: [
            ...groupLoader.group.threads.filter(t => t.id !== message.payload.id),
            { ...groupLoader.group.threads.find(t => t.id === message.payload.id), ...message.payload },
          ],
        })
        break
      case 'thread.deleted':
        console.log("Thread deleted: ", message)
        groupLoader.mutate({ ...groupLoader.group, threads: groupLoader.group.threads?.filter(m => m.id !== message.payload.id) }, false)
        if(chat?.type === 'thread' && chat?.id === message.payload.id) setChat(undefined)
        break
      case 'message.created':
        console.log("New message: ", message)
        let group = { ...groupLoader.group }
        if(message.payload.chat.type === "chat") {
          group.members.find(m => m.id === message.payload.chat.id).chat.messages.push(message.payload.message)
        } else if(message.payload.chat.type === "thread") {
          const messages = group.threads.find(m => m.id === message.payload.chat.id)?.messages || []
          group.threads.find(m => m.id === message.payload.chat.id).messages = [...messages, message.payload.message]
        }
        groupLoader.mutate(group)
        break
      }
    }

    ws.onclose = () => {
      console.log("Websocket closed")
      setConnected(false)
    }
    
    ws.onerror = () => {
      console.log("Websocket errored")
      setConnected(false)
    }
  }

  function setChatWrapped(type: string, id: string) {
    var group = { ...groupLoader.group }

    if(chat && (chat.type !== type || chat.id !== id) && (window.audioEnabled || window.videoEnabled)) {
      if(!confirm("Are you sure you want to switch rooms? You will be disconnected from audio and video")) return
    }

    if(chat?.type === 'thread') {
      let threads = [...groupLoader.group.threads]
      threads.find(t => t.id === chat.id).last_seen = Date.now().toString()
      groupLoader.mutate({ ...group, threads }, false)
    } else if(chat?.type === 'chat') {
      let members = [...group.members]
      members.find(t => t.id === chat.id).chat = { 
        ...(members.find(t => t.id === chat.id).chat || {}),
        last_seen: Date.now().toString(),
      }
      groupLoader.mutate({ ...group, members }, false)
    }

    localStorage.setItem(`group/${props.id}/chat`, JSON.stringify({ type, id }))
    setChat({ type, id })
  }

  // default to the last opened chat, or the first
  if(chat === undefined && (groupLoader.group?.threads?.length || 0) > 0) {
    const chatStr = localStorage.getItem(`group/${props.id}/chat`)
    if(chatStr) {
      const { type, id } = JSON.parse(chatStr)
      setChatWrapped(type, id)
    } else {
      setChatWrapped('thread', groupLoader.group.threads[0].id)
    }
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
    if(!channel?.length) return

    try {
      const thread = await createThread(props.id, channel)
      groupLoader.mutate({ ...groupLoader.group!, threads: [...groupLoader.group!.threads, thread] })
      setChat({ type: 'thread', id: thread.id })
    } catch (error) {
      alert(`Error creating channel ${channel}: ${error}`)
    }
  }

  async function sendInvite() {
    var email = window.prompt("Enter the email address of the user you want to invite")
    if(!email?.length) return

    try {
      await createInvite(props.id, email)
      alert(`Invite sent to ${email}`)
    } catch (error) {
      alert(`Error sending invite to ${email}: ${error}`)
    }
  }

  async function renameGroupPopup() {
    var name = window.prompt("Enter the new name of the group")
    if(!name?.length) return

    try {
      await renameGroup(props.id, name)
      groupLoader.mutate({ ...groupLoader.group, name })
    } catch (error) {
      alert(`Error renaming group: ${error}`)
    }
  }

  function logoutPopup() {
    if(!window.confirm("Are you sure you want to logout?")) return
    router.push('/logout')
  }

  async function leaveGroupPopup() {
    if(!window.confirm("Are you sure you want to leave this group")) return

    try {
      await leaveGroup(props.id)
      window.location.href = '/'
    } catch (error) {
      alert(`Error leaving group: ${error}`)
    }
  }

  async function deleteThreadPopup() {
    if(!window.confirm("Are you sure you want to delete this room")) return

    try {
      await deleteThread(chat.id)
      groupLoader.mutate({ 
        ...groupLoader.group,
        threads: groupLoader.group.threads?.filter(t => t.id !== chat.id),
      })
      setChat(undefined)
    } catch (error) {
      alert(`Error deleting room: ${error}`)
    }
  }

  async function renameThreadPopup() {
    var name = window.prompt("Enter the new name of the room")
    if(!name?.length) return

    try {
      await updateThread(chat.id, name)
    } catch (error) {
      alert(`Error renaming thread: ${error}`)
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

  function renderSettings(): JSX.Element {
    return <div className={styles.settingsContainer}>
      <div className={styles.background} onClick={() => setViewSettings(false)} />
      <div className={styles.settings}>
        <h1>Settings</h1>

        <section>
          <h2>Group</h2>
          <ul>
            <li onClick={() => router.push('/')}>Switch group</li>
            <li onClick={leaveGroupPopup}>Leave group</li>
            <li onClick={renameGroupPopup}>Rename group</li>
            <li>Manage invites<span className={styles.comingSoon}>Coming Soon</span></li>
            <li>Manage people<span className={styles.comingSoon}>Coming Soon</span></li>
          </ul>
        </section>

        <section>
          <h2>Profile</h2>
          <ul>
            <li onClick={logoutPopup}>Logout</li>
            <li>Edit profile<span className={styles.comingSoon}>Coming Soon</span></li>
            <li>Delete profile<span className={styles.comingSoon}>Coming Soon</span></li>
          </ul>
        </section>
      </div>
    </div>
  }

  let initials = '';
  const user = groupLoader.group?.members?.find(m => m.current_user)
  if(user) {
    initials = user.first_name.slice(0,1) + user.last_name.slice(0,1)
  }

  return <Layout overrideClassName={styles.container} loading={groupLoader.loading}>
    { viewSettings ? renderSettings() : null }

    <div className={styles.sidebar}>
      <div className={styles.upper} onClick={() => setViewSettings(true)}>
        <h1>{groupLoader.group?.name}</h1>

        <div className={styles.initials}>
          <p>{initials}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h3><span>🛋️</span> Rooms</h3>
        <ul>
          { uniqueByID(groupLoader.group?.threads || []).map(s => {
            const onClick = () => setChatWrapped('thread', s.id)
            const className = chat?.type === 'thread' && chat?.id === s.id ? styles.linkActive : null
            return <li className={className} onClick={onClick} key={s.id}>
              <p>{s.topic}</p>
              { showMsgIndicator('thread', s.id) ? <div className={styles.msgIndicator} /> : null }
            </li>
          })}
          <li className={styles.gray} key='room' onClick={createChannel}>New Room</li>
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
          <li className={styles.gray} key='invite' onClick={sendInvite}>Send Invite</li>
        </ul>
      </div>
    </div>

    <div className={styles.main}>
      { chat?.type === 'thread' ? <div className={styles.actionButtons}>
        <p onClick={deleteThreadPopup}><span>❌</span></p>
        <p onClick={renameThreadPopup}><span>✏️</span></p>
      </div> : null }

      { chat ? <ChatUI
                  key={chat.id}
                  chatType={chat.type}
                  chatID={chat.id}
                  messages={messages}
                  participants={participants} /> : null }
      </div>
 </Layout> 
}

function uniqueByID(array) {
  return array.filter((x, xi) => !array.slice(xi + 1).some(y => y.id === x.id));
}