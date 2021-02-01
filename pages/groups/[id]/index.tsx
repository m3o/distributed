// Frameworks
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

// Components
import ChatUI from '../../../components/chat'
import Layout from '../../../components/layout'

// Utilities
import { createGroup, createThread, useGroup } from '../../../lib/group'
import { createInvite, useInvites } from '../../../lib/invites'

// Styling
import styles from './index.module.scss'

interface Chat {
  type: string;
  id: string;
}

export default function Group(props) {
  const router = useRouter()
  const groupLoader = useGroup(router.query.id as string)
  const invitesLoader = useInvites(router.query.id as string)
  const [chat, setChat] = useState<Chat>();

  // todo: improve error handling
  if(groupLoader.error || invitesLoader.error) {
    router.push('/error')
    return <div />
  }

  let messages = [];
  if(chat?.type === 'thread') {
    messages = groupLoader?.group?.threads?.find(s => s.id === chat.id)?.messages || [];
  }

  async function createChannel() {
    var channel = window.prompt("Enter a new topic to discuss");
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
    var email = window.prompt("Enter the email address of the user you want to invite");
    if(!email.length) return

    try {
      await createInvite(router.query.id as string, email)
      alert(`Invite sent to ${email}`)
    } catch (error) {
      alert(`Error sending invite to ${email}: ${error}`)
    }
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
        <h3>Topics</h3>
        <ul>
          { groupLoader.group?.threads?.map(s => {
            const onClick = () => setChat({ type: 'thread', id: s.id })
            const className = chat?.type === 'thread' && chat?.id === s.id ? styles.linkActive : null
            return <li className={className} onClick={onClick} key={s.id}>{s.topic}</li>
          })}
          <li key='invite' onClick={createChannel}>New Topic</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h3>People</h3>
        <ul>
          { groupLoader.group?.members?.map(m => {
            const onClick = () => setChat({ type: 'chat', id: m.id })
            const className = chat?.type === 'chat' && chat?.id === m.id ? styles.linkActive : null            
            return <li key={m.id} className={className} onClick={onClick}>{m.first_name} {m.last_name}</li>
          })}
          <li key='invite' onClick={sendInvite}>Send Invite</li>
        </ul>
      </div>
    </div>

    { chat ? <ChatUI key={chat.id} videoCall={chat.type === 'stream'} chatType={chat.type} chatID={chat.id} messages={messages} /> : null }
 </Layout> 
}
