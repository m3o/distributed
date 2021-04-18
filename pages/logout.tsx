import { useRouter } from 'next/router'
import Layout from '../components/layout'
import { logout } from '../lib/user'

export default async function Logout() {
  const router = useRouter()

  const { loading } = await logout()
  if (!loading) {
    router.push('/login')
  }

  return <Layout loading={true} />
}
