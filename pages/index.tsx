import Layout from '../components/layout'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '../lib/user'
import { useGroups } from '../lib/group'
import styles from './index.module.scss'

export default function Home() {
  const router = useRouter()
  const userLoader = useUser()
  const groupsLoader = useGroups()

  if(userLoader.error) {
    router.push('/login')
    return <div />
  }
  
  // todo: improve error handling
  if(groupsLoader.error) {
    router.push('/error')
    return <div />
  }

  if(!groupsLoader.loading && !groupsLoader.groups?.length) {
    router.push('/groups/new')
    return <div />
  }

   return (
    <Layout loading={userLoader.loading || groupsLoader.loading}>
      <div className={styles.titleContainer}>
        <h1>Welcome {userLoader.user?.first_name}</h1>
        
        <Link href='/groups/new'>
          <button>New group</button>
        </Link>
      </div>

      <h2 className={styles.h2}>Groups:</h2>
      { groupsLoader.groups?.map(g => <Link href={`/groups/${g.id}`}>
        <p className={styles.group}>{g.name}</p>
      </Link>) }
    </Layout>
  )
}