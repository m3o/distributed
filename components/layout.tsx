import Head from 'next/head'
import Link from 'next/link'
import styles from './layout.module.scss'

interface Props {
  children?: any;
  loading: Boolean;
}

export default function Layout({ children, loading }: Props) {
  // render a spinner whilst waiting for the user
  if(loading) {
    return (
      <div className={styles.loadingContainer}>
        <img src='/loading.gif' alt='Loading' />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Distributed</title>
        <meta
          name="description"
          content="Keep connected with Distributed"/>
        <meta name="og:title" content="Distributed" />

        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
      </Head>
      
      <header className={styles.header}>
        <nav>
          <Link href='/logout'>
            <a>Logout</a>
          </Link>
        </nav>
      </header>
      <main>
        { children }
      </main>
    </div>
  )
}
