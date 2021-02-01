// Frameworks
import { Component, createRef } from 'react'
import Video from 'twilio-video'

// Components
import Layout from '../../components/layout'
import { getVideoProfile } from '../../lib/videos'

// Styling
import styles from './video.module.scss'

interface Props {
  id: string
}

interface State {
  room?: any;
}

export default class VideoComponent extends Component<Props, State> {
  readonly state: State = {}
  readonly localMedia = createRef<HTMLDivElement>()
  readonly remoteMedia = createRef<HTMLDivElement>()

  static async getInitialProps ({ query }) {
    return { id: query.id }
  }

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
    window.addEventListener("beforeunload", this.disconnectRoom);

    getVideoProfile()
      .then(profile => {
        console.log("Joining room '" + this.props.id + "'...")

        Video.connect(profile.token, { name: this.props.id }).then(this.roomJoined, error => {
          alert('Could not connect to Twilio: ' + error.message)
        })
      })
      .catch(err => alert(`Error loading video credentials: ${err}`))
  }

  componentWillUnmount() {
    this.disconnectRoom()
    window.removeEventListener("beforeunload", this.disconnectRoom);
  }
  
  disconnectRoom() {
    if(this.state.room) this.state.room.disconnect()
    this.setState({ room: undefined })
  }

	attachTracks(trackPubs, container: HTMLDivElement) {
		trackPubs.forEach(pub => {
      if (pub.isSubscribed) {
        console.log('already subscribed to: ', pub.trackName)
        return
      } 

      if(pub.track) { container.appendChild(pub.track.attach()) }

      console.log('subscribing to: ', pub.trackName)
      pub.on('subscribed', track => container?.appendChild(track.attach()))
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
		var previewContainer: any = this.localMedia.current
		if (!previewContainer?.querySelector('video')) {
			this.attachParticipantTracks(room.localParticipant, this.localMedia.current)
		}

    // Attach the Tracks of the room's participants.
    room.participants.forEach(participant => {
      console.log("Already in Room: '" + participant.identity + "'")
      this.attachParticipantTracks(participant, this.remoteMedia.current)
    })

    // Participant joining room
    room.on('participantConnected', participant => {
      console.log("Joining: '" + participant.identity + "'")
      this.attachParticipantTracks(participant, this.remoteMedia.current)
    })

    // Attach participant’s tracks to DOM when they add a track
    room.on('trackAdded', (track, participant) => {
      console.log(participant.identity + ' added track: ' + track.kind)
      this.attachTracks([track], this.remoteMedia.current)
    })

    // Detach participant’s track from DOM when they remove a track.
    room.on('trackRemoved', (track, participant) => {
      console.log(participant.identity + ' removed track: ' + track.kind)
      this.detachTracks([track])
    })

    // Detach all participant’s track when they leave a room.
    room.on('participantDisconnected', participant => {
      console.log("Participant '" + participant.identity + "' left the room")
      this.detachParticipantTracks(participant)
    })

    // Once the local participant leaves the room, detach the Tracks
    // of all other participants, including that of the LocalParticipant.
    room.on('disconnected', () => {
      this.detachParticipantTracks(room.localParticipant);
      room.participants.forEach(this.detachParticipantTracks);
    });
  }

	render() {
		return (
			<div className={styles.container}>
        <div className={styles.localMedia} ref={this.localMedia} />
        <div className={styles.remoteMedia} ref={this.remoteMedia} />
			</div>
		)
  }
}