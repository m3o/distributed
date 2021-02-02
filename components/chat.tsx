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

interface Props {
  // chatType, e.g. 'thread' or 'chat'
  chatType: string
  // if the chat is a thread, this is that threads ID
  chatID: string
  // any mesages preloaded
  messages?: Msg[]
  // callsEnabled enables video and audio calls
  callsEnabled?: boolean
}

interface State {
  messages: Msg[]
  loading: boolean
  message: string
  intervalID?: any
  joinedAudio: boolean
}

export default class Chat extends Component<Props, State> {
  readonly localMedia = createRef<HTMLDivElement>()
  readonly remoteMedia = createRef<HTMLDivElement>()

  constructor(props: Props) {
    super(props)
    this.state = {
      loading: false,
      message: '',
      messages: props.messages || [],
      joinedAudio: false,
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
    const { joinedAudio } = this.state
    const toggleAudio = () => this.setState({ joinedAudio: !joinedAudio })

    return <div className={styles.container}>
      <div className={styles.callsContainer}>
        <div className={styles.localMedia} ref={this.localMedia} />
        <div className={styles.remoteMedia} ref={this.remoteMedia} />

        { joinedAudio ? <Stream
                          audio={true}
                          video={false}
                          roomID={this.props.chatID}
                          localMediaRef={this.localMedia}
                          remoteMediaRef={this.remoteMedia} /> : null }

        { this.props.callsEnabled ? <p onClick={toggleAudio} className={styles.callButton}>{joinedAudio ? 'Leave' : 'Join'} audio</p> : null }
        { this.props.callsEnabled ? <Link href={`/videos/${this.props.chatID}`}>
          <p className={styles.callButton}>Join video</p>
        </Link> : null }
      </div>

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
  }
}

function sortMessages(a: Msg, b: Msg): number {
  return moment(a.sent_at).isAfter(b.sent_at) ? -1 : 1
}