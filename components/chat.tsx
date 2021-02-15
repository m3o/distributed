// Frameworks
import { Component } from 'react'
import { Picker } from 'emoji-mart'
import moment from 'moment'

// Components
import Message from './message'
import Stream from '../components/stream'

// Utilities
import { createMessage, Message as Msg } from '../lib/message'

// Styling
import styles from './chat.module.scss'
import { User } from '../lib/user'
import { setSeen } from '../lib/seen'
import { v4 as uuid } from 'uuid'
import 'emoji-mart/css/emoji-mart.css'

interface Props {
  // chatType, e.g. 'thread' or 'chat'
  chatType: string
  // if the chat is a thread, this is that threads ID
  chatID: string
  // any mesages preloaded
  messages?: Msg[]
  // participants in the conversation
  participants?: User[]
}

interface State {
  messages: Msg[]
  message: string
  listening: boolean
  joinedAudio: boolean
  joinedVideo: boolean
  onlineUserIDs: string[]
  showEmojiPicker: boolean
}

export default class Chat extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      message: '',
      messages: props.messages || [],
      listening: true,
      joinedAudio: false,
      joinedVideo: false,
      onlineUserIDs: [],
      showEmojiPicker: false,
    }
    this.sendMessage = this.sendMessage.bind(this)
    this.setSeen = this.setSeen.bind(this)
  }
  
  componentDidMount() {
    this.setSeen()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if(prevProps?.messages !== this.props.messages) {
      this.setState({ messages: [...this.state.messages, ...this.props.messages].filter((x, xi, arr) => !arr.slice(xi + 1).some(y => y.id === x.id)) })
    }

    if(this.state.messages !== prevState.messages || this.props.messages !== prevProps?.messages) this.setSeen()
  }

  async setSeen() {
    try {
      await setSeen(this.props.chatType, this.props.chatID)
    } catch(error) {
      console.error(`Error setting seen: ${error}`)
    }
  }
  
  sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const resource = { type: this.props.chatType, id: this.props.chatID }
    const message = { id: uuid(), text: this.state.message }
    
    createMessage(resource, message).catch(err => {
      alert(`Error sending message: ${err}`)
      this.setState({ messages: this.state.messages.filter(m => m.id !== message.id ) })
    })

    this.setState({ 
      message: '',
      messages: [
        ...this.state.messages,
        { 
          ...message,
          sent_at: Date.now(),
          author: this.props.participants?.find(p => p.current_user),
        },
      ],
    })
  }

  render() {
    return <div className={styles.container}>
      { this.renderStream() }

      <div onClick={() => this.setState({ showEmojiPicker: false })} className={styles.messages}>
        { this.state.messages.sort(sortMessages).map(m => <Message key={m.id} data={m} />) }
      </div>

      <div className={styles.compose}>
        <form onSubmit={this.sendMessage}>
          <input 
            required
            ref={r => r?.focus()}
            type='text'
            value={this.state.message} 
            placeholder='Send a message' 
            onChange={e => this.setState({ message: e.target.value || ''} )} />

          <p onClick={() => this.setState({ showEmojiPicker: !this.state.showEmojiPicker })}><span>🙂</span></p>
        </form>
        { this.state.showEmojiPicker ? <Picker
          showPreview={false}
          style={{ position: 'absolute', bottom: '70px', right: '20px' }}
          onSelect={(e) => this.setState({ message: this.state.message + e.native, showEmojiPicker: false })} /> : null }
      </div>
    </div>
  }

  renderStream(): JSX.Element {
    const { listening, joinedAudio, joinedVideo } = this.state
    const toggleAudio = () => this.setState({ joinedAudio: !joinedAudio })
    const toggleVideo = () => this.setState({ joinedVideo: !joinedVideo })
    const toggleListening = () => this.setState({ listening: !listening })

    const roomID = this.props.chatType === 'thread' ? this.props.chatID : this.props.participants.sort((a,b) => a.id > b.id ? 1 : -1).map(a => a.id).join("-")

    return(
      <div className={styles.stream}>
        <div className={styles.streamButtons}>
          <p onClick={toggleListening} className={[styles.button, listening ? styles.buttonActive : ''].join(' ')}>🔈</p>
          <p onClick={toggleAudio} className={[styles.button, joinedAudio ? styles.buttonActive : ''].join(' ')}>🎤</p>
          <p onClick={toggleVideo} className={[styles.button, joinedVideo ? styles.buttonActive : ''].join(' ')}>🎥</p>
        </div>
        
        <Stream
          roomID={roomID}
          audio={joinedAudio}
          video={joinedVideo}
          listening={listening}
          className={styles.media}
          participants={this.props.participants} />
      </div>
    )
  }
}

function sortMessages(a: Msg, b: Msg): number {
  return moment(a.sent_at).isAfter(b.sent_at) ? -1 : 1
}