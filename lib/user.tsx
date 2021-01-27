import { rejects } from 'assert';
import { da } from 'date-fns/locale';
import useSWR from 'swr';

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  current_user?: boolean;
}

export interface SignupParams {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

const fetcher = (url: string) => fetch(url).then(res => {
  if(res.status === 200 || res.status === 201) {
    return res.json();
  } else {
    throw `Error: ${res.statusText}`
  }
});

export function useUser (): { user?: User, loading: boolean, error: Error } {
  const { data, error } = useSWR("/api/profile", fetcher);
  console.log(data, error)

  return {
    user: error ? undefined : data?.user,
    loading: !error && !data,
    error: error,
  }
}

export function login(email: string, password: string): Promise<User> {
  return new Promise<User>((resolve: Function, reject: Function) => {
    fetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      .then(async (rsp) => {
        const body = await rsp.json()
        rsp.status === 200 ? resolve(body) : reject(body.error || rsp.statusText);
      })
      .catch(err => reject(err))
  })
}

export function logout(): { loading: boolean; error: Error } {
  const { data, error } = useSWR("/api/logout", fetcher);

  return {
    loading: !error && !data,
    error: error,
  }
}

export function signup(params: SignupParams): Promise<User> {
  return new Promise<User>((resolve: Function, reject: Function) => {
    fetch('/api/signup', { method: 'POST', body: JSON.stringify(params) })
      .then(async (rsp) => {
        try {
          const body = await rsp.json()
          rsp.status === 200 ? resolve(body) : reject(body.error || rsp.statusText);
        } catch {
          rsp.status === 200 ? resolve({}) : reject(rsp.statusText);
        }
      })
      .catch(err => reject(err))
  })
}