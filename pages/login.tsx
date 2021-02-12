import Head from 'next/head'
import { useState } from 'react'
import { login, signup } from '../lib/user'
import styles from './login.module.scss'

export default function Login() {
  const [isSignup, setSignup] = useState<boolean>(false)
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('')
  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>(null)

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault()

    if(isSignup && passwordConfirmation !== password) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    function onSuccess() {
      // push to homepage, temp hack to fix stale errors in homepage
      window.location.href = '/'
    }

    function onError(err: any) {
      setError(err)
      setLoading(false)
    }

    if(isSignup) {
      signup({ email, password, first_name: firstName, last_name: lastName }).then(onSuccess).catch(onError)
    } else {
      login(email, password).then(onSuccess).catch(onError)
    }
  }

  function toggleSignup(e: React.MouseEvent<HTMLParagraphElement>) {
    if(loading) return
    setSignup(!isSignup)
    setError(null)
  }
  
  const canSubmit = email.length && password.length && (isSignup ? firstName.length && lastName.length : true);

  return <div className={styles.container}>
    <Head>
      <title>Distributed - Login</title>
    </Head>

    <div className={styles.inner}>
      <img className={styles.logo} src='/logo.svg' alt='Distributed Logo' />
      <h1 className={styles.title}>Distributed</h1>
      { error ? <p className={styles.error}>{error}</p> : null }

      <form className={styles.form} onSubmit={onSubmit}>
        { isSignup ? <label>First name</label> : null }
        { isSignup ? <input
          required
          type='name'
          value={firstName}
          disabled={loading}
          placeholder='John'
          onChange={e => setFirstName(e.target.value || '')} /> : null }
        
        { isSignup ? <label>Last name</label> : null }
        { isSignup ? <input
          required
          type='name'
          value={lastName}
          disabled={loading}
          placeholder='Doe'
          onChange={e => setLastName(e.target.value || '')} /> : null }

        <label>Email address</label>
        <input
          required
          type='email'
          value={email}
          disabled={loading}
          placeholder='johndoe@distributed.app'
          onChange={e => setEmail(e.target.value || '')} />

        <label>Password</label>
        <input
          required
          type='password'
          value={password}
          disabled={loading}
          placeholder='Password'
          onChange={e => setPassword(e.target.value || '')} />

        { isSignup ? <label>Password Confirmation</label> : null }
        { isSignup ? <input
          required
          type='password'
          value={passwordConfirmation}
          disabled={loading}
          placeholder='Password Confirmation'
          onChange={e => setPasswordConfirmation(e.target.value || '')} />  : null }

        <input
          type="submit"
          disabled={!canSubmit}
          value={isSignup ? 'Signup' : 'Login'} />
      </form>

      <p onClick={toggleSignup} className={styles.switch}>
        { isSignup ? "Already have an account? Click here to login" : "Don't have an account? Click here to sign up" }
      </p>
    </div>
  </div>
}

