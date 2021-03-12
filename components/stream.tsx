// Frameworks
import { Component, createRef } from 'react'
import Twilio from 'twilio-video'

// Utilities
import { getVideoProfile } from '../lib/videos'
import { User } from '../lib/user'

import styles from './stream.module.scss'

interface Props {
  roomID: string
  audio?: boolean
  video?: boolean
  listening: boolean
  className?: string
  participants: User[]
}

interface State {
  room?: any
  token?: string
  identity?: string
  participants?: Record<string,Participant>
  connecting: boolean;
}

interface Participant {
  connectedAt?: number
  connection: any;
  user: User
}

export default class Stream extends Component<Props, State> {
	constructor(props: Props) {
    super(props)

    const participants = (props.participants || []).reduce((result, user) => ({ ...result, [user.id]: { user } }), {})
    this.state = { participants, connecting: false }

		this.roomJoined = this.roomJoined.bind(this)
		this.attachTracks = this.attachTracks.bind(this)
    this.disconnectRoom = this.disconnectRoom.bind(this)
  }

  componentDidMount() {
    window.addEventListener("beforeunload", this.disconnectRoom)

    getVideoProfile()
      .then(profile => this.setState({ ...profile }))
      .catch(err => alert(`Error loading video credentials: ${err}`))
  }

  componentWillUnmount() {
    this.disconnectRoom()
    window.removeEventListener("beforeunload", this.disconnectRoom)
  }

  async componentDidUpdate(prevProps?: Props, prevState?: State) {
    // update participants
    if(prevProps.participants?.length !== this.props.participants?.length) {
      let participants = {}
      this.props.participants.forEach(p => {
        const e = this.state.participants[p.id]
        participants[p.id] = e || { user: p }
      })
      this.setState({ participants })
      return
    }

    // require a token
    if(!this.state.token) return;

    // disconnect from the old room if joining a new room
    const { roomID, audio, video } = this.props
    const { room, token } = this.state
    if(roomID !== prevProps?.roomID && room) this.disconnectRoom()

    // todo: find a cleaner way to share this info globally. redux?
    window.audioEnabled = audio;
    window.videoEnabled = video;

    let tracksToAdd = [];
    if(audio && room && Array.from(room.localParticipant.audioTracks).length === 0) {
      tracksToAdd.push(await Twilio.createLocalAudioTrack())
    } else if(room && !audio) {
      Array.from(room.localParticipant.audioTracks).map(t => t[1].track).forEach(t => {
        t.stop()
        room.localParticipant.unpublishTrack(t)
      })
    }

    if(video && room && Array.from(room.localParticipant.videoTracks).length === 0) {
      tracksToAdd.push(await Twilio.createLocalVideoTrack())
    } else if(room && !video) {
      Array.from(room.localParticipant.videoTracks).map(t => t[1].track).forEach(t => {
        t.stop()
        room.localParticipant.unpublishTrack(t)
      })
    }

    if(room) {
      await Promise.all(tracksToAdd.map(t => room.localParticipant.publishTrack(t)))
    } else if(!this.state.connecting) {
      console.log(`Connecting with ${tracksToAdd.length} tracks`)
      this.setState({ connecting: true })
      await Twilio.connect(token, { name: roomID, tracks: tracksToAdd }).then(this.roomJoined, error => {
        alert('Could not connect to Twilio: ' + error.message)
      })
    }

    if(video !== prevProps?.video || audio !== prevProps?.audio) {
      this.setState({
        participants: {
          ...this.state.participants,
          [this.state.identity]: {
            ...this.state.participants[this.state.identity],
          },
        },
      })
    }
  }
  
  disconnectRoom() {
    if(!this.state.room) return
    console.log(`Leaving room: ${this.props.roomID}...`)
    this.state.room.disconnect()
    this.setState({ room: undefined, participants: {}, connecting: false })
  }

	attachTracks(trackPubs: any[]) {
    trackPubs.forEach(pub => {
      if (pub.isSubscribed) {
        console.log('already subscribed to: ', pub.trackName)
        return
      } 

      // handle local track which does not get subscribed to
      if(pub.track) {
        pub.track.attach().muted = true
        return
      }
      
      console.log('subscribing to: ', pub.trackName, pub.track)
      pub.on('subscribed', track => {
        if(track.kind === 'data') return;
        track.attach().muted = !this.props.listening
      })
		})
  }

	roomJoined(room) {
    console.log(`Joined room`, room)
    this.setState({ room, connecting: false })

		// Attach LocalParticipant's tracks
    var trackPubs = Array.from(room.localParticipant.tracks.values())
		this.attachTracks(trackPubs)
    
    // Attach the tracks of the room's participants.
    var participants = { ...this.state.participants }
    participants[this.state.identity].connection = room.localParticipant
    participants[this.state.identity].connectedAt = Date.now()
    room.participants.forEach(participant => {
      console.log("Already in Room: '" + participant.identity + "'")
      var trackPubs = Array.from(participant.tracks.values())
      this.attachTracks(trackPubs)
      participants[participant.identity].connection = participant
      participants[participant.identity].connectedAt = Date.now()
    })
    this.setState({ participants })

    // Participant joining room
    room.on('participantConnected', participant => {
      console.log("Joining: '" + participant.identity + "'")
      var trackPubs = Array.from(participant.tracks.values())
      this.attachTracks(trackPubs)
      this.setState({ 
        participants: {
          ...this.state.participants, 
          [participant.identity]: { 
            ...this.state.participants[participant.identity],
            connectedAt: Date.now(),
            connection: participant,
          },
        },
      })
    })

    // Attach participant’s tracks to DOM when they add a track
    room.on('trackAdded', (track, participant) => {
      console.log(participant.identity + ' added track: ' + track.kind)
      this.attachTracks([track])
    })

    // Detach all participant’s track when they leave a room.
    room.on('participantDisconnected', participant => {
      console.log("Participant '" + participant.identity + "' left the room")
      this.setState({ 
        participants: {
          ...this.state.participants, 
          [participant.identity]: { ...this.state.participants[participant.identity], connected: false, connectedAt: undefined }, 
        },
      })  
    })
  }

	render() {
    const identity = this.state.identity;
    const listening = this.props.listening;
    const participants = Object.values(this.state.participants)
                               .filter(p => !!p.connectedAt)
                               .sort((a,b) => a.connectedAt - b.connectedAt)

		return <div className={`${this.props.className} ${styles.container}`}>
      { participants.map(p => {
        const muted = p.user.id === identity ? true : !listening

        return <ParticipantComponent
                  key={p.user.id}
                  participant={p}
                  muted={muted}
                  videoEnabled={true} />
      })}
    </div>
  }
}

interface ParticipantProps {
  muted: boolean
  participant: Participant
  videoEnabled: boolean
}

const events = [
  "disconnected",
  "reconnected",
  "reconnecting",
  "trackDimensionsChanged",
  "trackDisabled",
  "trackEnabled",
  "trackMessage",
  "trackPublished",
  "trackPublishPriorityChanged",
  "trackStarted",
  "trackSubscribed",
  "trackSubscriptionFailed",
  "trackSwitchedOff",
  "trackSwitchedOn",
  "trackUnpublished",
  "trackUnsubscribed",
  "trackDisabled",
  "trackEnabled",
  "trackStopped",
]

class ParticipantComponent extends Component<ParticipantProps> {
  readonly state: { size?: number, audioEnabled: boolean, videoEnabled: boolean }
  readonly videoRef = createRef<HTMLVideoElement>()
  readonly audioRef = createRef<HTMLAudioElement>()

  constructor(props: ParticipantProps) {
    super(props)
    this.state = { size: 0, audioEnabled: false, videoEnabled: false }
    this.onClick = this.onClick.bind(this)
    this.connectTrack = this.connectTrack.bind(this)
    this.disconnectTrack = this.disconnectTrack.bind(this)

  }

  connectTrack(x: any) {
    if(!x.track && !x.attach) return;

    try {
      console.log('connect', x.kind, x.attach().srcObject, this.videoRef.current)

      if(x.kind === 'audio') {
        this.setState({ audioEnabled: true })
        this.audioRef.current.srcObject = x.track ? x.track.attach().srcObject : x.attach().srcObject
      } else {
        this.setState({ videoEnabled: true })
        this.videoRef.current.srcObject = x.track ? x.track.attach().srcObject : x.attach().srcObject
      }
    } catch (error) {
      console.warn(error)
    }
  }

  disconnectTrack(x: any) {
    if(x.kind === 'audio') {
      this.audioRef.current.srcObject = undefined
      this.setState({ audioEnabled: false })
    } else {
      this.videoRef.current.srcObject = undefined
      this.setState({ videoEnabled: false })
    }
  }

  componentDidMount() {
    this.audioRef.current.muted = this.props.muted
    this.videoRef.current.muted = this.props.muted
    
    // enable this for awesome debugging:
    events.forEach(e => this.props.participant.connection.on(e, x => console.log(e,x)))

    this.props.participant.connection.tracks.forEach(this.connectTrack)
    this.props.participant.connection.on('trackStarted', this.connectTrack)
    this.props.participant.connection.on('trackStopped', this.disconnectTrack)
    this.props.participant.connection.on('trackUnpublished', this.disconnectTrack)
  }

  componentDidUpdate(prevProps: ParticipantProps) {
    if(prevProps.muted !== this.props.muted) {
      this.audioRef.current.muted = this.props.muted
      this.videoRef.current.muted = this.props.muted
    }
  }

  onClick(): void {
    let size = this.state.size + 1
    if(size > 2) size = 0
    this.setState({ size })
  }

  render(): JSX.Element {
    const { audioEnabled, videoEnabled } = this.state;
    const { participant } = this.props
    const sizeStyle = { 0: styles.small, 1: styles.medium, 2: styles.large }[this.state.size]

    // Note: do not set muted when rendering the video / audio components:
    // https://github.com/facebook/react/issues/10389
    return (
      <div className={`${styles.participant} ${sizeStyle}`} onClick={this.onClick}>
        <audio autoPlay playsInline ref={this.audioRef} />
        <video style={videoEnabled ? {} : { display: "none" }} autoPlay playsInline ref={this.videoRef} />
        { videoEnabled ? null : <p>{participant.user.first_name}</p> }
        { videoEnabled ? null : <p className={styles.icons}>{audioEnabled ? <span>🎤</span> : null}{videoEnabled ? <span>🎥</span> : null}</p> }
      </div>
    )
  }

  audioTrack(props: ParticipantProps) {
    return Array.from(props.participant.connection.audioTracks).map(x => x[1])[0]?.track
  }

  videoTrack(props: ParticipantProps) {
    return Array.from(props.participant.connection.videoTracks).map(x => x[1])[0]?.track
  }
}