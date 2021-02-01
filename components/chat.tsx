import moment from 'moment'
import Message from './message'
import styles from './chat.module.scss'
import { Component } from 'react'
import { createMessage, fetchMessage, Message as Msg } from '../lib/message'
import Link from 'next/link'

interface Props {
  // chatType, e.g. 'stream' or 'chat'
  chatType: string;
  // if the chat is a stream, this is that streams ID
  chatID: string;
  // any mesages preloaded
  messages?: Msg[]
  // videoCall enabled
  videoCall?: boolean
}

interface State {
  messages: Msg[]
  loading: boolean
  message: string
  intervalID?: any
}

export default class Chat extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      loading: false,
      message: '',
      messages: props.messages || [],
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
      { this.props.videoCall ? <Link href={`/videos/${this.props.chatID}`}>
        <p className={styles.videoCall}>Join video call</p>
      </Link> : null }

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