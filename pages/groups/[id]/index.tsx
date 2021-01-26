// Frameworks
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

// Components
import Chat from '../../../components/chat'
import Layout from '../../../components/layout'

// Utilities
import { useGroup } from '../../../lib/group'
import { useInvites } from '../../../lib/invites'

// Styling
import styles from './index.module.scss'

export default function Group(props) {
  const router = useRouter()
  const groupLoader = useGroup(router.query.id as string)
  const invitesLoader = useInvites(router.query.id as string)
  const [streamID, setStreamID] = useState<string>();

  // todo: improve error handling
  if(groupLoader.error || invitesLoader.error) {
    router.push('/error')
    return <div />
  }

  const stream = groupLoader?.group?.streams?.find(s => s.id === streamID);

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
        <h3>Channels</h3>
        <ul>
          { groupLoader.group?.streams?.map(s => {
            const onClick = () => setStreamID(s.id)
            const className = streamID === s.id ? styles.linkActive : null
            return <li className={className} onClick={onClick} key={s.id}>{s.topic}</li>
          })}
        </ul>
      </div>

      <div className={styles.section}>
        <h3>Friends</h3>
        <ul>
          { groupLoader.group?.members?.map(m => {
            return <li key={m.id}>{m.first_name} {m.last_name}</li>
          })}
        </ul>
      </div>
    </div>

    { stream ? <Chat streamID={stream.id} messages={stream.messages} /> : null }
 </Layout> 
}