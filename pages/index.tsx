import Layout from '../components/layout'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '../lib/user'
import { useGroups } from '../lib/group'
import styles from './index.module.scss'
import { acceptInvite, rejectInvite, Invite, useInvites } from '../lib/invites'
import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(process.env.STRIPE_PUBLIC_KEY);

export default function Home() {
  const router = useRouter()
  const userLoader = useUser()
  const groupsLoader = useGroups()
  const invitesLoader = useInvites()

  if(userLoader.error || groupsLoader.error || invitesLoader.error) {
    router.push('/login')
    return <div />
  }
  
  if(userLoader.loading || groupsLoader.loading || invitesLoader.loading) {
    return <Layout loading={true} />
  }

  function accept(invite: Invite) {
    acceptInvite(invite.id)
      .then(() => router.push(`/groups/${invite.group.id}`))
      .catch((error: string) => {
        alert(`Error accepting invite: ${error}`)
      })
  }

  function reject(invite: Invite) {
    invitesLoader.mutate(invitesLoader.invites?.filter(i => i.id !== invite.id), false)
    rejectInvite(invite.id).catch((error: string) => alert(`Error rejecting invite: ${error}`))
  }

  return (
    <Layout>
      <div className={styles.inner}>
        <div className={styles.titleContainer}>
          <h1>Welcome {userLoader.user?.first_name}</h1>
        </div>

        <div className={styles.titleContainer}>
          <Link href='/groups/new'>
            <button>New Group</button>
          </Link>
        </div>

        { invitesLoader.invites?.length ? <div>
          <h2 className={styles.h2}>Invites:</h2>
          { invitesLoader.invites?.map(i => <div className={styles.group}>
            <p>{i.group.name}</p>
            <button onClick={() => accept(i)} className={styles.accept}>Accept</button>
            <button onClick={() => reject(i)} className={styles.reject}>Reject</button>
          </div>) }
        </div> : null }

        { groupsLoader.groups?.length ? <div>
          <h2 className={styles.h2}>Your Groups</h2>
          <div className={styles.groups}>
            { groupsLoader.groups?.map(g => <div className={styles.group}>
              <p>{g.name}</p>
              <Link href={`/groups/${g.id}`}>
                <button>Enter</button>
              </Link>
            </div>) }
          </div>
        </div> : null }

      </div>
    </Layout>
  )
}
