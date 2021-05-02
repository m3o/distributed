import classNames from 'classnames'
import uniqBy from 'lodash.uniqby'
import Error from 'next/error'
import { useRouter } from 'next/router'
import { Dispatch, useCallback, useEffect, useRef, useState } from 'react'
import type { ChatUIRefAttrs } from '../../../components/chat'
import ChatUI from '../../../components/chat'
import GifInput from '../../../components/gifInput'
import Layout from '../../../components/layout'
import {
  createThread,
  deleteThread,
  leaveGroup,
  removeMember,
  renameGroup,
  updateThread,
  useGroup,
} from '../../../lib/group'
import {
  createInvite,
  Invite,
  revokeInvite,
  useInvites,
} from '../../../lib/invites'
import { Message } from '../../../lib/message'
import { deleteProfile, updateUser, User, useUser } from '../../../lib/user'
import { useWsClient } from '../../../lib/wsClient'
import styles from './index.module.scss'

interface Chat {
  type: string
  id: string
}

type Subview =
  | 'settings'
  | 'chat-settings'
  | 'edit-profile'
  | 'manage-invites'
  | 'gif'

export default function Group() {
  const router = useRouter()
  const groupId: string = (router.query?.id || '').toString()
  const groupLoader = useGroup(groupId)
  const userLoader = useUser()
  const [activeChat, setActiveChat] = useState<Chat>()
  const [activeSubview, setActiveSubview] = useState<Subview>(undefined)
  const [showSidebar, setShowSidebar] = useState<boolean>(false)
  const [enabledVideo, setEnabledVideo] = useState(false)
  const [enabledAudio, setEnabledAudio] = useState(false)
  const chatRef = useRef<ChatUIRefAttrs>()

  const wsConfig = groupLoader.group?.websocket
  useWsClient({
    url: wsConfig?.url,
    reconnectOnClose: true,
    onopen: (_, ws) => {
      ws.send(JSON.stringify({ token: wsConfig.token, topic: wsConfig.topic }))
    },
    onmessage: ({ data }) => {
      // todo: fix duplicate encoding?!
      const event = JSON.parse(data)
      const message = JSON.parse(JSON.parse(event.message))

      if (message.group_id && message.group_id !== groupId) {
        console.log('Ignoring message: ', message)
        return
      }

      switch (message.type) {
        case 'group.updated':
          console.log('Group updated:', message)
          groupLoader.mutate({ ...groupLoader.group, ...message })
          break
        case 'group.user.left':
          console.log('User left group:', message)
          if (message.payload.current_user) {
            alert('You have been removed from the group')
            router.push('/')
            return
          }
          groupLoader.mutate(
            {
              ...groupLoader.group,
              members: groupLoader.group.members?.filter(
                (m) => m.id !== message.payload.id
              ),
            },
            false
          )
          break
        case 'group.user.joined':
          console.log('User joined group:', message)
          groupLoader.mutate({
            ...groupLoader.group,
            members: [...groupLoader.group.members, message.payload],
          })
          break
        case 'tread.created':
          console.log('Thread created: ', message)
          groupLoader.mutate({
            ...groupLoader.group,
            threads: [...groupLoader.group.threads, message.payload],
          })
          break
        case 'thread.updated':
          console.log('Thread updated: ', message)
          groupLoader.mutate({
            ...groupLoader.group,
            threads: [
              ...groupLoader.group.threads.filter(
                (t) => t.id !== message.payload.id
              ),
              {
                ...groupLoader.group.threads.find(
                  (t) => t.id === message.payload.id
                ),
                ...message.payload,
              },
            ],
          })
          break
        case 'thread.deleted':
          console.log('Thread deleted: ', message)
          groupLoader.mutate(
            {
              ...groupLoader.group,
              threads: groupLoader.group.threads?.filter(
                (m) => m.id !== message.payload.id
              ),
            },
            false
          )
          if (
            activeChat?.type === 'thread' &&
            activeChat?.id === message.payload.id
          ) {
            setActiveChat(undefined)
          }
          break
        case 'message.created': {
          console.log('New message: ', message)
          const group = { ...groupLoader.group }
          if (message.payload.chat.type === 'chat') {
            group.members
              .find((m) => m.id === message.payload.chat.id)
              .chat.messages.push(message.payload.message)
          } else if (message.payload.chat.type === 'thread') {
            const messages =
              group.threads.find((m) => m.id === message.payload.chat.id)
                ?.messages || []
            group.threads.find(
              (m) => m.id === message.payload.chat.id
            ).messages = [...messages, message.payload.message]
          }
          groupLoader.mutate(group)
          break
        }
      }
    },
  })

  const onSetChat = useCallback(
    (type: string, id: string) => {
      const group = { ...groupLoader.group }

      if (
        activeChat &&
        (activeChat.type !== type || activeChat.id !== id) &&
        (enabledAudio || enabledVideo)
      ) {
        const confirmation = confirm(
          'Are you sure you want to switch rooms? You will be disconnected from audio and video'
        )
        if (!confirmation) return
      }

      if (activeChat?.type === 'thread') {
        const threads = [...groupLoader.group.threads]
        if (!threads) {
          console.log('No threads loaded')
          return
        }
        const thr = threads.find((t) => t.id === activeChat.id)
        if (thr) {
          thr.last_seen = new Date().toISOString()
        }
        groupLoader.mutate({ ...group, threads }, false)
      } else if (activeChat?.type === 'chat') {
        const members = [...group.members]
        const thr = members.find((t) => t.id === activeChat.id)
        if (thr) {
          thr.chat = {
            ...(members.find((t) => t.id === activeChat.id).chat || {}),
            last_seen: new Date().toISOString(),
          }
        }
        groupLoader.mutate({ ...group, members }, false)
      }

      localStorage.setItem(
        `group/${groupId}/chat`,
        JSON.stringify({ type, id })
      )
      setActiveChat({ type, id })
      if (showSidebar) setShowSidebar(false)
    },
    [activeChat, groupId, groupLoader, showSidebar, enabledVideo, enabledAudio]
  )

  useEffect(() => {
    if (activeChat) return
    if (!groupLoader.group?.threads) return
    if (groupLoader.group.threads.length === 0) return

    // default to the last opened chat, or the first
    const chatJson = localStorage.getItem(`group/${groupId}/chat`)

    if (chatJson) {
      const { type, id } = JSON.parse(chatJson)
      onSetChat(type, id)
    } else if (groupLoader.group.threads?.length) {
      onSetChat('thread', groupLoader.group.threads[0].id)
    }
  }, [activeChat, groupId, groupLoader, onSetChat])

  const onClearChat = useCallback(() => {
    localStorage.removeItem(`group/${groupId}/chat`)
    setActiveChat(undefined)
  }, [groupId, setActiveChat])

  useEffect(() => {
    if (!activeChat) return

    let thread
    if (activeChat?.type === 'thread') {
      thread = groupLoader?.group?.threads?.find((t) => t.id === activeChat.id)
    } else if (activeChat?.type === 'chat') {
      thread = groupLoader?.group?.members?.find((m) => m.id === activeChat.id)
    }
    if (!thread) onClearChat()
  }, [activeChat, groupLoader, onClearChat])

  if (groupLoader.error || userLoader.error) {
    return (
      <Error
        statusCode={404}
        title={groupLoader.error?.message || userLoader.error?.message}
      />
    )
  }

  const initials =
    (userLoader.user?.first_name || '').slice(0, 1) +
    (userLoader.user?.last_name || '').slice(0, 1)

  let messages = []
  let participants = []
  if (activeChat?.type === 'thread') {
    const thread = groupLoader?.group?.threads?.find(
      (t) => t.id === activeChat.id
    )
    messages = thread?.messages || []
    participants = groupLoader?.group?.members || []
  } else if (activeChat?.type === 'chat') {
    const member = groupLoader?.group?.members?.find(
      (m) => m.id === activeChat.id
    )
    messages = member?.chat?.messages || []
    participants = groupLoader.group.members.filter(
      (m) => m.id === activeChat.id || m.current_user
    )
  }

  async function createChannel() {
    const channel = window.prompt('Enter a new room name')
    if (!channel?.length) return

    try {
      const thread = await createThread(groupId, channel)
      groupLoader.mutate({
        ...groupLoader.group!,
        threads: [...groupLoader.group!.threads, thread],
      })
      setActiveChat({ type: 'thread', id: thread.id })
    } catch (error) {
      alert(`Error creating channel ${channel}: ${error}`)
    }
  }

  function createWhiteboard() {
    chatRef.current?.sendMessage('whiteboard')
  }

  async function sendInvite() {
    const email = window.prompt(
      'Enter the email address of the user you want to invite'
    )
    if (!email?.length) return

    try {
      const invite = await createInvite(groupId, email)
      const url = `${window.location.protocol}//${
        window.location.host
      }/login?code=${invite.code}&email=${encodeURI(invite.email)}`
      alert(`Invite sent to ${email}. Link to signup: ${url}`)
    } catch (error) {
      alert(`Error sending invite to ${email}: ${error}`)
    }
  }

  function showMsgIndicator(type: string, id: string): boolean {
    let resource: { messages?: Message[]; last_seen?: string }

    if (type === 'chat') {
      resource = groupLoader.group.members.find((m) => m.id === id)?.chat
    } else if (type === 'thread') {
      resource = groupLoader.group.threads.find((m) => m.id === id)
    }

    if (activeChat?.type === type && activeChat?.id === id) return false
    if (!resource?.messages?.length) return false
    if (!resource.last_seen) return true

    const lastSeen = Date.parse(resource.last_seen)
    let showIndicator = false
    resource.messages
      .filter((m) => !m.author?.current_user)
      .forEach((msg) => {
        const sentAt = Date.parse(msg.sent_at as string)
        if (sentAt > lastSeen) showIndicator = true
      })
    return showIndicator
  }

  function dismissMenu(e: React.MouseEvent<HTMLDivElement>): void {
    setShowSidebar(false)
    setActiveSubview(undefined)
    e.stopPropagation()
  }

  return (
    <Layout
      overrideClassName={styles.container}
      loading={groupLoader.loading || userLoader.loading}
    >
      {activeSubview === 'settings' && (
        <SubviewSettings
          activeChat={activeChat}
          groupId={groupId}
          setActiveSubview={setActiveSubview}
        />
      )}
      {activeSubview === 'chat-settings' && (
        <SubviewChatSettings
          activeChat={activeChat}
          groupId={groupId}
          setActiveSubview={setActiveSubview}
        />
      )}
      {activeSubview === 'edit-profile' && (
        <SubviewEditProfile
          activeChat={activeChat}
          groupId={groupId}
          setActiveSubview={setActiveSubview}
        />
      )}
      {activeSubview === 'manage-invites' && (
        <SubviewManageInvites
          activeChat={activeChat}
          groupId={groupId}
          setActiveSubview={setActiveSubview}
        />
      )}
      {activeSubview === 'gif' && (
        <GifInput
          threadId={activeChat.id}
          groupId={groupId}
          onDismiss={() => setActiveSubview(undefined)}
        />
      )}

      <div
        className={classNames({
          [styles.sidebar]: true,
          [styles.show]: showSidebar,
        })}
      >
        <div
          className={styles.upper}
          onClick={() => setActiveSubview('settings')}
        >
          <h1>{groupLoader.group?.name}</h1>

          <div className={styles.initials}>
            <p>{initials}</p>
          </div>

          <div className={styles.dismiss} onClick={dismissMenu}>
            <p>🔙</p>
          </div>

          <div className={styles.settingsIcon}>
            <p>⚙️</p>
          </div>
        </div>

        <div className={styles.section}>
          <h3>
            <span>🛋️</span> Rooms
          </h3>
          <ul>
            {uniqBy(groupLoader.group?.threads || [], 'id').map((t) => {
              const onClick = () => onSetChat('thread', t.id)
              const className = classNames({
                [styles.linkActive]:
                  activeChat?.type === 'thread' && activeChat?.id === t.id,
              })
              return (
                <li className={className} onClick={onClick} key={t.id}>
                  <p>{t.topic}</p>
                  {showMsgIndicator('thread', t.id) && (
                    <div className={styles.msgIndicator} />
                  )}
                </li>
              )
            })}
            <li className={styles.gray} key="room" onClick={createChannel}>
              New Room
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h3>
            <span>👨‍👩‍👦</span> People
          </h3>
          <ul>
            {groupLoader.group?.members
              ?.filter((u) => !u.current_user)
              ?.map((m) => {
                const onClick = () => onSetChat('chat', m.id)
                const className = classNames({
                  [styles.linkActive]:
                    activeChat?.type === 'chat' && activeChat?.id === m.id,
                })
                return (
                  <li key={m.id} className={className} onClick={onClick}>
                    <p>
                      {m.first_name} {m.last_name}
                    </p>
                    {showMsgIndicator('chat', m.id) && (
                      <div className={styles.msgIndicator} />
                    )}
                  </li>
                )
              })}
            <li className={styles.gray} key="invite" onClick={sendInvite}>
              Send Invite
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.actionButtons}>
          <p
            className={styles.burgerIcon}
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <span>🍔</span>
          </p>
          {activeChat && (
            <p onClick={() => setActiveSubview('chat-settings')}>
              <span>⚙️</span>
            </p>
          )}
          {activeChat && (
            <p onClick={createWhiteboard}>
              <span>✏️</span>
            </p>
          )}
          {activeChat?.type === 'thread' && (
            <p onClick={() => setActiveSubview('gif')}>
              <span>🤪</span>
            </p>
          )}
        </div>

        {activeChat && (
          <ChatUI
            key={activeChat.id}
            ref={chatRef}
            chatType={activeChat.type}
            chatId={activeChat.id}
            initialMessages={messages}
            participants={participants}
            enabledVideo={enabledVideo}
            setEnabledVideo={setEnabledVideo}
            enabledAudio={enabledAudio}
            setEnabledAudio={setEnabledAudio}
          />
        )}
      </div>
    </Layout>
  )
}

interface SubviewProps {
  activeChat?: Chat
  groupId?: string
  setActiveSubview?: Dispatch<Subview>
}

function SubviewSettings({ groupId, setActiveSubview }: SubviewProps) {
  const router = useRouter()
  const groupLoader = useGroup(groupId)

  async function renameGroupPopup() {
    const name = window.prompt('Enter the new name of the group')
    if (!name?.length) return

    try {
      await renameGroup(groupId, name)
      groupLoader.mutate({ ...groupLoader.group, name })
    } catch (error) {
      alert(`Error renaming group: ${error}`)
    }
  }

  async function logoutPopup() {
    if (!window.confirm('Are you sure you want to logout?')) return
    router.push('/logout')
  }

  async function deleteProfilePopup() {
    if (!window.confirm('Are you sure you want to delete your profile?')) return

    try {
      await deleteProfile()
      router.push('/logout')
    } catch (error) {
      alert(`Error deleting profile: ${error}`)
    }
  }

  async function leaveGroupPopup() {
    if (!window.confirm('Are you sure you want to leave this group')) return

    try {
      await leaveGroup(groupId)
      router.push('/')
    } catch (error) {
      alert(`Error leaving group: ${error}`)
    }
  }

  return (
    <div className={styles.settingsContainer}>
      <div
        className={styles.background}
        onClick={() => setActiveSubview(undefined)}
      />
      <div className={styles.settings}>
        <h1>Settings</h1>
        <div
          className={styles.dismiss}
          onClick={() => setActiveSubview(undefined)}
        >
          <p>🔙</p>
        </div>

        <section>
          <h2>Group</h2>
          <ul>
            <li onClick={() => router.push('/')}>Switch group</li>
            <li onClick={() => leaveGroupPopup()}>Leave group</li>
            <li onClick={() => renameGroupPopup()}>Rename group</li>
            <li onClick={() => setActiveSubview('manage-invites')}>
              Manage invites
            </li>
          </ul>
        </section>

        <section>
          <h2>Profile</h2>
          <ul>
            <li onClick={() => setActiveSubview('edit-profile')}>
              Edit profile
            </li>
            <li onClick={() => deleteProfilePopup()}>Delete profile</li>
            <li onClick={() => logoutPopup()}>Logout</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

function SubviewChatSettings({
  activeChat,
  groupId,
  setActiveSubview,
}: SubviewProps) {
  const groupLoader = useGroup(groupId)

  async function deleteThreadPopup() {
    if (!window.confirm('Are you sure you want to delete this room')) return

    try {
      await deleteThread(activeChat.id)
      groupLoader.mutate({
        ...groupLoader.group,
        threads: groupLoader.group.threads?.filter(
          (t) => t.id !== activeChat.id
        ),
      })
    } catch (error) {
      alert(`Error deleting room: ${error}`)
    }
  }

  async function removeUserPopuop() {
    if (
      !window.confirm(
        'Are you sure you want to remove this user from the group?'
      )
    )
      return

    try {
      await removeMember(groupId, activeChat.id)
      groupLoader.mutate({
        ...groupLoader.group,
        threads: groupLoader.group.members?.filter(
          (m) => m.id !== activeChat.id
        ),
      })
    } catch (error) {
      alert(`Error removing user: ${error}`)
    }
  }

  async function renameThreadPopup() {
    const name = window.prompt('Enter the new name of the room')
    if (!name?.length) return

    try {
      await updateThread(activeChat.id, name)
    } catch (error) {
      alert(`Error renaming thread: ${error}`)
    }
  }

  return (
    <div className={styles.settingsContainer}>
      <div
        className={styles.background}
        onClick={() => setActiveSubview(undefined)}
      />
      <div className={styles.settings}>
        <h1>{activeChat.type === 'thread' ? 'Room' : 'User'} Settings</h1>
        <div
          className={styles.dismiss}
          onClick={() => setActiveSubview(undefined)}
        >
          <p>🔙</p>
        </div>

        <section>
          <ul>
            {activeChat.type === 'thread' && (
              <li
                onClick={() => {
                  renameThreadPopup()
                  setActiveSubview(undefined)
                }}
              >
                Rename room
              </li>
            )}
            {activeChat.type === 'thread' && (
              <li
                onClick={() => {
                  deleteThreadPopup()
                  setActiveSubview(undefined)
                }}
              >
                Delete room
              </li>
            )}
            {activeChat.type === 'chat' && (
              <li
                onClick={() => {
                  removeUserPopuop()
                  setActiveSubview(undefined)
                }}
              >
                Remove user from group
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}

function SubviewEditProfile({ setActiveSubview }: SubviewProps) {
  const userLoader = useUser()
  const [user, setUser] = useState(userLoader?.user)

  useEffect(() => {
    setUser(userLoader.user)
  }, [userLoader?.user])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveSubview(undefined)
    updateUser(user)
      .then((data: { user: User }) => {
        userLoader.mutate(data, false)
      })
      .catch((err) => alert(`Error updating profile: ${err}`))
  }

  return (
    <div className={styles.settingsContainer}>
      <div
        className={styles.background}
        onClick={() => setActiveSubview(undefined)}
      />
      <div className={styles.settings}>
        <h1>Edit Profile</h1>
        <div
          className={styles.dismiss}
          onClick={() => setActiveSubview('settings')}
        >
          <p>🔙</p>
        </div>

        <form onSubmit={onSubmit}>
          <input
            required
            placeholder="First name"
            value={user.first_name}
            onChange={(e) =>
              setUser({ ...user, first_name: e.target.value || '' })
            }
          />

          <input
            required
            placeholder="Last name"
            value={user.last_name}
            onChange={(e) =>
              setUser({ ...user, last_name: e.target.value || '' })
            }
          />

          <input
            required
            placeholder="Email"
            value={user.email}
            onChange={(e) => setUser({ ...user, email: e.target.value || '' })}
          />

          <input type="submit" value="Save changes" />
        </form>
      </div>
    </div>
  )
}

function SubviewManageInvites({ groupId, setActiveSubview }: SubviewProps) {
  const inviteLoader = useInvites(groupId)

  function deleteInvite(i: Invite) {
    const invites = [...inviteLoader.invites]
    if (!confirm(`Are you sure you want to delete the invite for ${i.email}?`))
      return

    revokeInvite(i.id)
      .then(() => inviteLoader.mutate(invites.filter((x) => i.id !== x.id)))
      .catch((err) => alert(`Erorr revoking invite: ${err}`))
  }

  return (
    <div className={styles.settingsContainer}>
      <div
        className={styles.background}
        onClick={() => setActiveSubview(undefined)}
      />
      <div className={styles.settings}>
        <h1>Manage Invites</h1>
        <div
          className={styles.dismiss}
          onClick={() => setActiveSubview('settings')}
        >
          <p>🔙</p>
        </div>

        <section>
          {inviteLoader.loading ? (
            <p className={styles.loadingState}>Loading...</p>
          ) : inviteLoader.error ? (
            <p className={styles.errorState}>
              Error: {inviteLoader.error.message}
            </p>
          ) : !(inviteLoader.invites?.length > 0) ? (
            <p className={styles.emptyState}>There are no pending invites</p>
          ) : (
            <ul>
              {inviteLoader.invites?.map((i) => (
                <li key={i.id} onClick={() => deleteInvite(i)}>
                  <p>{i.email}</p>
                  <p>Click to delete</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
