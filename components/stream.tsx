// Frameworks
import { Component, createRef } from 'react'
import Video from 'twilio-video'

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
}

interface Participant {
  videoStream?: MediaStream
  audioStream?: MediaStream
  user: User
  connectedAt?: number
}

export default class Stream extends Component<Props, State> {
	constructor(props: Props) {
    super(props)
    
    const participants = (props.participants || []).reduce((result, user) => ({ ...result, [user.id]: { user } }), {})
    this.state = { participants }

		this.roomJoined = this.roomJoined.bind(this)
		this.addMedia = this.addMedia.bind(this)
		this.removeMedia = this.addMedia.bind(this)
		this.attachTracks = this.attachTracks.bind(this)
		this.detachTracks = this.detachTracks.bind(this)
    this.disconnectRoom = this.disconnectRoom.bind(this)
		this.detachParticipantTracks = this.detachParticipantTracks.bind(this)
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

  componentDidUpdate(prevProps?: Props, prevState?: State) {
    const { token, room } = this.state
    if(!token) return

    if(prevProps.participants !== this.props.participants) {
      let participants: Record<string,Participant> = {}
      this.props.participants.forEach(p => {
        const e = this.state.participants[p.id]
        participants[p.id] = e || { user: p }
      })
      this.setState({ participants })
    }

    const { roomID, audio, video } = this.props
    const audioChanged = audio !== prevProps?.audio
    const videoChanged = video !== prevProps?.video
    const roomIDChanged = roomID !== prevProps?.roomID
    const tokenChanged = token !== prevState?.token

    // don't update without reason
    if(!audioChanged && !videoChanged && !roomIDChanged && !tokenChanged) return

    // todo: find a cleaner way to share this info globally. redux?
    window.audioEnabled = audio;
    window.videoEnabled = video;
    
    // disconnect from the old room if joining a new room
    if(roomIDChanged && room) this.disconnectRoom()

    console.log(`${room ? 'Reconnecting to' : 'Joining'} room ${roomID}`)
    Video.connect(token, { name: roomID, audio, video }).then(this.roomJoined, error => {
      alert('Could not connect to Twilio: ' + error.message)
    })
  }
  
  disconnectRoom() {
    if(!this.state.room) return
    console.log(`Leaving room: ${this.props.roomID}...`)
    this.state.room.disconnect()
    this.setState({ room: undefined, participants: {} })
  }

  addMedia(id: string, track: { attach: Function, kind: 'video' | 'audio' }) {
    const media = track.attach()
    media.muted = id === this.state.identity ? true : !this.props.listening

    let participant = { ...this.state.participants[id] }
    if(track.kind === 'audio') {
      participant.audioStream = track.attach().srcObject
    } else {
      participant.videoStream = track.attach().srcObject
    }

    this.setState({ participants: { ...this.state.participants, [id]: participant } })
  }

  removeMedia(id: string, track: { detach: Function, kind: 'video' | 'audio' }) {
    let participant = { ...this.state.participants[id] }
    if(track.kind === 'audio') {
      participant.audioStream = undefined
    } else {
      participant.videoStream = undefined
    }

    this.setState({ participants: { ...this.state.participants, [id]: participant } })
  }

	attachTracks(id: any, trackPubs: any[]) {
    trackPubs.forEach(pub => {
      if (pub.isSubscribed) {
        console.log('already subscribed to: ', pub.trackName)
        return
      } 

      // handle local track which does not get subscribed to
      if(pub.track) {
        this.addMedia(id, pub.track)
        return
      }
      
      console.log('subscribing to: ', pub.trackName, pub.track)
      pub.on('subscribed', track => this.addMedia(id, track))
      pub.on('unsubscribed', track => this.removeMedia(id, track))
		})
  }
  
	detachTracks(participant: any, trackPubs) {
		trackPubs.forEach(pub => {
      if(pub.track) this.removeMedia(participant.identity, pub.track)
		})
	}

	detachParticipantTracks(participant) {
		var tracks = Array.from(participant.tracks.values())
		this.detachTracks(participant, tracks)
	}

	roomJoined(room) {
    this.setState({ room })

		// Attach LocalParticipant's tracks
    var trackPubs = Array.from(room.localParticipant.tracks.values())
		this.attachTracks(this.state.identity, trackPubs)
    
    // Attach the tracks of the room's participants.
    var participants = { ...this.state.participants }
    participants[this.state.identity].connectedAt = Date.now()
    room.participants.forEach(participant => {
      console.log("Already in Room: '" + participant.identity + "'")
      var trackPubs = Array.from(participant.tracks.values())
      this.attachTracks(participant.identity, trackPubs)
      participants[participant.identity].connectedAt = Date.now()
    })
    this.setState({ participants })

    // Participant joining room
    room.on('participantConnected', participant => {
      console.log("Joining: '" + participant.identity + "'")
      var trackPubs = Array.from(participant.tracks.values())
      this.attachTracks(participant.identity, trackPubs)
      this.setState({ 
        participants: {
          ...this.state.participants, 
          [participant.identity]: { ...this.state.participants[participant.identity], connectedAt: Date.now() }, 
        },
      })
    })

    // Attach participant’s tracks to DOM when they add a track
    room.on('trackAdded', (track, participant) => {
      console.log(participant.identity + ' added track: ' + track.kind)
      this.attachTracks(participant, [track])
    })

    // Detach participant’s track from DOM when they remove a track.
    room.on('trackRemoved', (track, participant) => {
      console.log(participant.identity + ' removed track: ' + track.kind)
      this.detachTracks(participant, [track])
    })

    // Detach all participant’s track when they leave a room.
    room.on('participantDisconnected', participant => {
      console.log("Participant '" + participant.identity + "' left the room")
      this.detachParticipantTracks(participant)
      this.setState({ 
        participants: {
          ...this.state.participants, 
          [participant.identity]: { ...this.state.participants[participant.identity], connected: false, connectedAt: undefined }, 
        },
      })  
    })

    // Once the local participant leaves the room, detach the Tracks
    // of all other participants, including that of the LocalParticipant.
    room.on('disconnected', () => {
      this.detachParticipantTracks(room.localParticipant)
      room.participants.forEach(this.detachParticipantTracks)
    })
  }

	render() {
    const participants = Object.values(this.state.participants)
                               .filter(p => !!p.connectedAt)
                               .sort((a,b) => a.connectedAt - b.connectedAt)

		return <div className={`${this.props.className} ${styles.container}`}>
      { participants.map(p => {
        const muted = p.user.id === this.state.identity ? true : !this.props.listening
        return <ParticipantComponent key={p.user.id} participant={p} muted={muted} videoEnabled={this.props.video} />
      })}
    </div>
  }
}

class ParticipantComponent extends Component<{ participant: Participant, muted: boolean, videoEnabled: boolean }> {
  readonly state: { videoStream?: MediaStream, audioStream?: MediaStream, size?: number }
  readonly videoRef = createRef<HTMLVideoElement>()
  readonly audioRef = createRef<HTMLAudioElement>()

  constructor(props) {
    super(props)
    this.state = {
      size: 0,
      videoStream: props.participant.videoStream,
      audioStream: props.participant.audioStream,
    }
    this.onClick = this.onClick.bind(this)
  }

  componentDidUpdate() {
    let { videoStream, audioStream } = this.props.participant
    if(videoStream?.id !== this.state.videoStream?.id) {
      this.videoRef.current.srcObject = videoStream
      this.setState({ videoStream })
    }
    if(audioStream?.id !== this.state.audioStream?.id) {
      this.audioRef.current.srcObject = audioStream
      this.setState({ audioStream })
    }
  }

  onClick(): void {
    let size = this.state.size + 1
    if(size > 2) size = 0
    this.setState({ size })
  }

  render(): JSX.Element {
    const { muted, participant, videoEnabled } = this.props
    const { videoStream, audioStream, size } = this.state

    const sizeStyle = { 0: styles.small, 1: styles.medium, 2: styles.large }[size]

    return (
      <div className={`${styles.participant} ${sizeStyle}`} onClick={this.onClick}>
        <audio muted={muted} autoPlay playsInline ref={this.audioRef} />
        <video style={videoStream?.active && videoEnabled ? {} : { display: "none" }} muted={muted} autoPlay playsInline ref={this.videoRef} />
        { videoStream?.active && videoEnabled ? null : <p>{participant.user.first_name}</p> }
        { videoStream?.active && videoEnabled ? null : <p className={styles.icons}>{audioStream?.active ? <span>🎤</span> : null}{videoStream?.active ? <span>🎥</span> : null}</p> }
      </div>
    )
  }
}