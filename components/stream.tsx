// Frameworks
import { de } from 'date-fns/esm/locale'
import { Component } from 'react'
import Video from 'twilio-video'

// Utilities
import { getVideoProfile } from '../lib/videos'

interface Props {
  roomID: string
  audio?: boolean
  video?: boolean
  listening: boolean
  localMediaRef: React.RefObject<HTMLDivElement>
  remoteMediaRef: React.RefObject<HTMLDivElement>
  participantsUpdated?: (ids: string[]) => void
}

interface State {
  room?: any
  token?: string
  identity?: string
  participantIDs: string[]
}

export default class Stream extends Component<Props, State> {
  readonly state: State = { participantIDs: [] }

	constructor(props) {
    super(props)
		this.roomJoined = this.roomJoined.bind(this)
		this.attachTracks = this.attachTracks.bind(this)
		this.detachTracks = this.detachTracks.bind(this)
    this.disconnectRoom = this.disconnectRoom.bind(this)
		this.attachParticipantTracks = this.attachParticipantTracks.bind(this)
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

    // when the listening changes, toggle the attribute on the video element
    if(prevProps?.listening !== this.props.listening) {
      Object.values(this.props.remoteMediaRef.current.getElementsByTagName("audio")).forEach(a => {
        a.muted = !this.props.listening
      })
    }

    // notify the parent component when a participant joins / leaves the stream
    if(prevState?.participantIDs?.length !== this.state.participantIDs?.length && this.props.participantsUpdated) {
      this.props.participantsUpdated(this.state.participantIDs)
    }

    const { roomID, audio, video } = this.props;
    const audioChanged = audio !== prevProps?.audio
    const videoChanged = video !== prevProps?.video
    const roomIDChanged = roomID !== prevProps?.roomID
    const tokenChanged = token !== prevState?.token

    // don't update without reason
    if(!audioChanged && !videoChanged && !roomIDChanged && !tokenChanged) return
    
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
    this.setState({ room: undefined, participantIDs: [] })
  }

	attachTracks(trackPubs, container: HTMLDivElement) {
    trackPubs.forEach(pub => {
      if (pub.isSubscribed) {
        console.log('already subscribed to: ', pub.trackName)
        return
      } 

      if(pub.track) { container.appendChild(pub.track.attach()) }
      
      console.log('subscribing to: ', pub.trackName)
      pub.on('subscribed', track => {
        let media = track.attach()
        if(pub.kind === 'audio' && container === this.props.remoteMediaRef.current) media.muted = !this.props.listening
        container?.appendChild(media)
      })
      pub.on('unsubscribed', track => track.detach().forEach(e => e.remove()))
		})
  }
  
	// Attaches a track to a specified DOM container
	attachParticipantTracks(participant, container) {
		var trackPubs = Array.from(participant.tracks.values())
		this.attachTracks(trackPubs, container)
	}

	detachTracks(trackPubs) {
		trackPubs.forEach(pub => {
      if(!pub.track) return
			pub.track.detach().forEach(e => e.remove())
		})
	}

	detachParticipantTracks(participant) {
		var tracks = Array.from(participant.tracks.values())
		this.detachTracks(tracks)
	}

	roomJoined(room) {
    this.setState({ room })

		// Attach LocalParticipant's Tracks, if not already attached.
		var previewContainer: any = this.props.localMediaRef.current
		if (!previewContainer?.querySelector('video')) {
      this.attachParticipantTracks(room.localParticipant, this.props.localMediaRef.current)
		}
    
    // Attach the Tracks of the room's participants.
    room.participants.forEach(participant => {
      console.log("Already in Room: '" + participant.identity + "'")
      this.attachParticipantTracks(participant, this.props.remoteMediaRef.current)
    })
    const ids = Object.values(room.participants).map((p: any) => p.identity)
    this.setState({ participantIDs: [...ids, this.state.identity] })

    // Participant joining room
    room.on('participantConnected', participant => {
      console.log("Joining: '" + participant.identity + "'")
      this.setState({ participantIDs: [...this.state.participantIDs, participant.identity] })
      this.attachParticipantTracks(participant, this.props.remoteMediaRef.current)
    })

    // Attach participant’s tracks to DOM when they add a track
    room.on('trackAdded', (track, participant) => {
      console.log(participant.identity + ' added track: ' + track.kind)
      this.attachTracks([track], this.props.remoteMediaRef.current)
    })

    // Detach participant’s track from DOM when they remove a track.
    room.on('trackRemoved', (track, participant) => {
      console.log(participant.identity + ' removed track: ' + track.kind)
      this.detachTracks([track])
    })

    // Detach all participant’s track when they leave a room.
    room.on('participantDisconnected', participant => {
      console.log("Participant '" + participant.identity + "' left the room")
      this.setState({ participantIDs: this.state.participantIDs.filter(id => id !== participant.identity) })
      this.detachParticipantTracks(participant)
    })

    // Once the local participant leaves the room, detach the Tracks
    // of all other participants, including that of the LocalParticipant.
    room.on('disconnected', () => {
      this.detachParticipantTracks(room.localParticipant)
      room.participants.forEach(this.detachParticipantTracks)
    })
  }

	render() {
		return <div />
  }
}