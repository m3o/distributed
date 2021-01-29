import useSWR from 'swr';
import { User } from './user';
import { Message } from './message';

export interface Group {
  id: string;
  name: string;
  members?: User[];
  threads?: Thread[];
}

export interface Thread {
  id: string;
  topic: string;
  messages?: Message[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useGroups (): { groups?: Group[], loading: boolean, error: Error } {
  const { data, error } = useSWR("/api/groups", fetcher);
  
  return {
    groups: error ? undefined : data,
    loading: !error && !data,
    error: error,
  }
}

export function useGroup (id: string): { group?: Group, loading: boolean, error: Error, mutate: Function } {
  const { data, error, mutate } = useSWR("/api/groups/" + id, fetcher);
  
  return {
    group: error ? undefined : data,
    loading: !error && !data,
    error: error,
    mutate,
  }
}

export function createGroup(name: string): Promise<Group> {
  return new Promise<Group>((resolve: Function, reject: Function) => {
    fetch('/api/groups', { method: 'POST', body: JSON.stringify({ name }) })
      .then(async (rsp) => {
        const body = await rsp.json()
        rsp.status === 201 ? resolve(body) : reject(body.error || rsp.statusText);
      })
      .catch(err => reject(err))
  })
}

export function createThread(groupID: string, topic: string): Promise<Thread> {
  return new Promise<Thread>((resolve: Function, reject: Function) => {
    fetch(`/api/groups/${groupID}/threads`, { method: 'POST', body: JSON.stringify({ topic }) })
      .then(async (rsp) => {
        const body = await rsp.json()
        rsp.status === 201 ? resolve(body) : reject(body.error || rsp.statusText);
      })
      .catch(err => reject(err))
  })
}