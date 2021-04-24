import { useRouter } from 'next/router'
import { useState } from 'react'
import Layout from '../../components/layout'
import { createGroup, useGroups } from '../../lib/group'
import styles from './new.module.scss'

export default function Home() {
  const router = useRouter()
  const groupsLoader = useGroups()

  const [name, setName] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      await createGroup(name)
      router.push('/')
    } catch ({ error, code }) {
      console.warn(error)
      setSubmitting(false)
    }
  }

  return (
    <Layout className={styles.container} loading={groupsLoader.loading}>
      <h1 className={styles.title}>
        {groupsLoader.groups?.length
          ? 'Create a group'
          : 'Create your first group'}
      </h1>

      <form onSubmit={onSubmit}>
        {groupsLoader.error ? (
          <p className={styles.error}>
            {JSON.stringify(
              groupsLoader.error,
              Object.getOwnPropertyNames(groupsLoader.error),
              2
            )}
          </p>
        ) : null}
        <label>Name</label>
        <input
          required
          type="text"
          value={name}
          minLength={1}
          maxLength={100}
          disabled={submitting || Boolean(groupsLoader.error)}
          onChange={(e) => setName(e.target.value || '')}
        />

        <input
          type="submit"
          value="Create group"
          disabled={
            submitting || Boolean(groupsLoader.error) || name.length === 0
          }
        />
      </form>
    </Layout>
  )
}
