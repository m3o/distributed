// Frameworks
import { Component, createRef } from 'react'
import Link from 'next/link'
import moment from 'moment'

// Components
import Message from './message'
import Stream from '../components/stream'

// Utilities
import { createMessage, fetchMessage, Message as Msg } from '../lib/message'

// Styling
import styles from './chat.module.scss'
import { User } from '../lib/user'

interface Props {
  // chatType, e.g. 'thread' or 'chat'
  chatType: string
  // if the chat is a thread, this is that threads ID
  chatID: string
  // any mesages preloaded
  messages?: Msg[]
  // callsEnabled enables video and audio calls
  callsEnabled?: boolean
  // participants in the conversation
  participants?: User[]
}

interface State {
  messages: Msg[]
  loading: boolean
  message: string
  intervalID?: any
  listening: boolean
  joinedAudio: boolean
  joinedVideo: boolean
  onlineUserIDs: string[];
}

export default class Chat extends Component<Props, State> {
  readonly mediaRef = createRef<HTMLDivElement>()

  constructor(props: Props) {
    super(props)
    this.state = {
      loading: false,
      message: '',
      messages: props.messages || [],
      listening: false,
      joinedAudio: false,
      joinedVideo: false,
      onlineUserIDs: [],
    }
    this.sendMessage = this.sendMessage.bind(this)
    this.fetchMessages = this.fetchMessages.bind(this)
  }
  
  componentDidMount() {
    this.fetchMessages()
    const intervalID = setInterval(this.fetchMessages, 5000)
    this.setState({ intervalID })
  }

  componentWillUnmount() {
    if(this.state.intervalID) {
      clearInterval(this.state.intervalID)
      this.setState({ intervalID: undefined })
    }
  }

  async fetchMessages() {
    try {
      const msgs = await fetchMessage(this.props.chatType, this.props.chatID)
      const messages = [...this.state.messages, ...msgs].filter((value, index, self) => self.findIndex(v => v.id === value.id) === index)
      this.setState({ messages })
    } catch(error) {
      console.error(`Error loading messages: ${error}`)
    }
  }
  
  sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    this.setState({ loading: true })

    createMessage(this.props.chatType, this.props.chatID, this.state.message)
      .then(msg => this.setState({ messages: [...this.state.messages, msg], loading: false, message: '' }))
      .catch(err => {
        this.setState({ loading: false })
        alert(`Error sending message: ${err}`)
      })
  }

  render() {
    return <div className={styles.container}>
      { this.props.callsEnabled ? this.renderStream() : null }

      <div className={styles.inner}>
        <div className={styles.messages}>
          { this.state.messages.sort(sortMessages).map(m => <Message key={m.id} data={m} />) }
        </div>

        <div className={styles.compose}>
          <form onSubmit={this.sendMessage}>
            <input 
              required
              ref={r => r?.focus()}
              type='text'
              value={this.state.message} 
              disabled={this.state.loading}
              placeholder='Send a message' 
              onChange={e => this.setState({ message: e.target.value || ''} )} />
          </form>
        </div>
      </div>
    </div>
  }

  renderStream(): JSX.Element {
    const { listening, joinedAudio, joinedVideo, onlineUserIDs } = this.state
    const toggleAudio = () => this.setState({ joinedAudio: !joinedAudio })
    const toggleVideo = () => this.setState({ joinedVideo: !joinedVideo })
    const toggleListening = () => this.setState({ listening: !listening })

    return(
      <div className={styles.stream}>
        <Stream
          audio={joinedAudio}
          video={joinedVideo}
          listening={listening}
          roomID={this.props.chatID}
          localMediaRef={this.mediaRef}
          remoteMediaRef={this.mediaRef} 
          participantsUpdated={(onlineUserIDs) => this.setState({ onlineUserIDs })} />

        <p onClick={toggleListening} className={[styles.button, listening ? styles.buttonActive : ''].join(' ')}>{listening ? 'Stop' : 'Start'} listening</p>
        <p onClick={toggleAudio} className={[styles.button, joinedAudio ? styles.buttonActive : ''].join(' ')}>{joinedAudio ? 'Leave' : 'Join'} audio</p>
        <p onClick={toggleVideo} className={[styles.button, joinedVideo ? styles.buttonActive : ''].join(' ')}>{joinedVideo ? 'Leave' : 'Join'} video</p>

        <div className={styles.participants}>
          <h3>Members</h3>
          { this.props.participants?.map(p => {
            const online = onlineUserIDs.includes(p.id)

            return(
              <div className={styles.participant} key={p.id}>
                <div className={styles.onlineStatus} style={{ backgroundColor: online ? 'green' : 'red' }} />
                <p>{p.first_name} {p.last_name}</p>
              </div>
            )
          })}
        </div>

        <div className={styles.media} ref={this.mediaRef} />
      </div>
    )
  }
}

function sortMessages(a: Msg, b: Msg): number {
  return moment(a.sent_at).isAfter(b.sent_at) ? -1 : 1
}