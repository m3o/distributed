import classNames from 'classnames'
import { Picker } from 'emoji-mart'
import 'emoji-mart/css/emoji-mart.css'
import uniqBy from 'lodash.uniqby'
import moment from 'moment'
import {
  Dispatch,
  forwardRef,
  SetStateAction,
  useEffect,
  useImperativeHandle,
  useState,
  ForwardRefRenderFunction,
} from 'react'
import { v4 as uuid } from 'uuid'
import Stream from '../components/stream'
import { createMessage, Message as Msg } from '../lib/message'
import { setSeen } from '../lib/seen'
import { User } from '../lib/user'
import styles from './chat.module.scss'
import Message from './message'

function messageComparator(a: Msg, b: Msg): number {
  return moment(a.sent_at).isAfter(b.sent_at) ? -1 : 1
}

export interface ChatUIRefAttrs {
  // eslint-disable-next-line no-unused-vars
  sendMessage: (text: string) => void
}

export interface ChatUIProps {
  // chatType, e.g. 'thread' or 'chat'
  chatType: string
  // if the chat is a thread, this is that threads ID
  chatId: string
  // any mesages preloaded
  initialMessages?: Msg[]
  // participants in the conversation
  participants?: User[]
  // whether video is enabled
  enabledVideo: boolean
  setEnabledVideo: Dispatch<SetStateAction<boolean>>
  // whether audio is enabled
  enabledAudio: boolean
  setEnabledAudio: Dispatch<SetStateAction<boolean>>
}

const ChatUI: ForwardRefRenderFunction<ChatUIRefAttrs, ChatUIProps> = (
  {
    chatType,
    chatId,
    initialMessages,
    participants,
    enabledVideo,
    setEnabledVideo,
    enabledAudio,
    setEnabledAudio,
  },
  ref
) => {
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<Msg[]>(initialMessages || [])
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false)

  const updateSeen = async (chatType: string, chatId: string) => {
    try {
      await setSeen(chatType, chatId)
    } catch (error) {
      console.error(`Error setting seen: ${error}`)
    }
  }

  useEffect(() => {
    updateSeen(chatType, chatId)
  }, [chatType, chatId])

  useEffect(() => {
    setMessages((c) =>
      uniqBy([...(initialMessages || []), ...c], 'id').sort(messageComparator)
    )
  }, [initialMessages])

  const sendMessage = (text: string) => {
    const resource = { type: chatType, id: chatId }
    const msg = { id: uuid(), text }

    createMessage(resource, msg).catch((err) => {
      alert(`Error sending message: ${err}`)
      setMessages((c) => c.filter((m) => m.id !== msg.id))
    })

    setMessages((c) =>
      [
        ...c,
        {
          ...msg,
          sent_at: new Date().toISOString(),
          author: participants?.find((p) => p.current_user),
        },
      ].sort(messageComparator)
    )
  }

  useImperativeHandle(ref, () => ({
    sendMessage,
  }))

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    sendMessage(message)
    setMessage('')
  }

  const roomId =
    chatType === 'thread'
      ? chatId
      : participants
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .map((a) => a.id)
          .join('-')

  return (
    <div className={styles.container}>
      <div className={styles.stream}>
        <div className={styles.streamButtons}>
          <p
            onClick={() => setEnabledAudio((c) => !c)}
            className={classNames({
              [styles.button]: true,
              [styles.buttonActive]: enabledAudio,
            })}
          >
            🎙️
          </p>
          <p
            onClick={() => setEnabledVideo((c) => !c)}
            className={classNames({
              [styles.button]: true,
              [styles.buttonActive]: enabledVideo,
            })}
          >
            📹
          </p>
        </div>

        <Stream
          roomId={roomId}
          className={styles.media}
          participants={participants}
          enabledVideo={enabledVideo}
          setEnabledVideo={setEnabledVideo}
          enabledAudio={enabledAudio}
          setEnabledAudio={setEnabledAudio}
        />
      </div>

      <div
        onClick={() => setShowEmojiPicker(false)}
        className={styles.messages}
      >
        {messages.map((m) => (
          <Message key={m.id} data={m} />
        ))}
      </div>

      <div className={styles.compose}>
        <form onSubmit={onSubmit}>
          <input
            required
            type="text"
            placeholder="Send a message"
            value={message}
            onChange={(e) => setMessage(e.target.value || '')}
          />

          <p onClick={() => setShowEmojiPicker((c) => !c)}>
            <span>🙂</span>
          </p>
        </form>
        {showEmojiPicker && (
          <Picker
            showPreview={false}
            style={{ position: 'absolute', bottom: '70px', right: '20px' }}
            onSelect={(e) => {
              setMessage((c) => c + e.native)
              setShowEmojiPicker(false)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default forwardRef(ChatUI)
