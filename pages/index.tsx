import Layout from '../components/layout'
import { useRouter } from 'next/router'
import { useUser } from '../lib/user'

export default function Home() {
  const router = useRouter()
  const { user, error, loading } = useUser()
  console.log("HERE", user, error, loading)

  if(error) {
    router.push('/login')
    return <div />
  }

   return (
    <Layout loading={loading}>
      <h1>Welcome {user?.first_name}</h1>
    </Layout>
  )
}