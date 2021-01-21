import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from "../../../components/layout"
import { useGroup } from "../../../lib/group"
import { useInvites } from '../../../lib/invites'
import styles from './index.module.scss'

export default function Group(props) {
  const router = useRouter()
  const groupLoader = useGroup(router.query.id as string)
  const invitesLoader = useInvites(router.query.id as string)
  
  // todo: improve error handling
  if(groupLoader.error || invitesLoader.error) {
    router.push('/error')
    return <div />
  }

  return <Layout loading={groupLoader.loading || invitesLoader.loading}>
    <div className={styles.titleContainer}>
      <h1>{groupLoader.group?.name}</h1>
      
      <Link href={`/groups/${groupLoader.group?.id}/invites/new`}>
        <button>Invite</button>
      </Link>
    </div>

    <h3>Members</h3>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        { groupLoader?.group?.members?.map(m => <tr key={m.id}>
          <td>{m.first_name}</td>
          <td>{m.last_name}</td>
          <td>{m.email}</td>
        </tr>)}
      </tbody>
    </table>

    <h3>Invites</h3>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Email</th>
          <th>Code</th>
        </tr>
      </thead>
      <tbody>
        { invitesLoader?.invites?.map(i => <tr key={i.id}>
          <td>{i.email}</td>
          <td>{i.code}</td>
        </tr>)}
      </tbody>
    </table>
  </Layout>
}