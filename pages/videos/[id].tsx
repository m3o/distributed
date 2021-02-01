// Frameworks
import { Component } from 'react'
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
  previewTracks?: any
  localMediaAvailable?: boolean
  hasJoinedRoom?: boolean
}

export default class VideoComponent extends Component<Props, State> {
  static async getInitialProps ({ query }) {
    const id = query.id
    return { id }
  }

	constructor(props) {
    super(props)

		this.state = {
			localMediaAvailable: false,
			hasJoinedRoom: false,
    }
    
		this.roomJoined = this.roomJoined.bind(this)
		this.attachTracks = this.attachTracks.bind(this)
		this.detachTracks = this.detachTracks.bind(this)
		this.attachParticipantTracks = this.attachParticipantTracks.bind(this)
		this.detachParticipantTracks = this.detachParticipantTracks.bind(this)
  }
  
  componentDidMount() {
    getVideoProfile()
      .then(profile => {
        console.log("Joining room '" + this.props.id + "'...")

        let connectOptions: any = {
          name: this.props.id
        }

        if (this.state.previewTracks) {
          connectOptions.tracks = this.state.previewTracks
        }

        // Join the Room with the token from the server and the
        // LocalParticipant's Tracks.
        Video.connect(profile.token, connectOptions).then(this.roomJoined, error => {
          alert('Could not connect to Twilio: ' + error.message)
        })
      })
      .catch(err => alert(`Error loading video credentials: ${err}`))
  }

	attachTracks(trackPubs, container) {
		trackPubs.forEach(pub => {
      if (pub.isSubscribed) {
        console.log(pub)
        console.log(pub.track)
        console.log(pub.track.attach())
      } else if(pub.track) {
        container.appendChild(pub.track.attach())
      } else {
        console.log('not subscribed to: ', pub.trackName)
      }

      pub.on('subscribed', track => {
        container.appendChild(track.attach())
      })
      pub.on('unsubscribed', track => {
        track.detach().forEach(e => e.remove())
      })

    
      // console.log(!!pub.track, pub)
      // if(!pub.track) return
			// container.appendChild(pub.track.attach())
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
		// Called when a participant joins a room
		this.setState({
			localMediaAvailable: true,
			hasJoinedRoom: true
    })

		// Attach LocalParticipant's Tracks, if not already attached.
		var previewContainer: any = this.refs.localMedia
		if (!previewContainer.querySelector('video')) {
			this.attachParticipantTracks(room.localParticipant, previewContainer)
		}
    if (!previewContainer.querySelector('video')) {
      this.attachParticipantTracks(room.localParticipant, previewContainer)
    }

    // Attach the Tracks of the room's participants.
    room.participants.forEach(participant => {
      console.log("Already in Room: '" + participant.identity + "'")
      var previewContainer = this.refs.remoteMedia
      console.log("attachParticipantTracks", participant)
      this.attachParticipantTracks(participant, previewContainer)
    })

    // Participant joining room
    room.on('participantConnected', participant => {
      console.log("Joining: '" + participant.identity + "'")
      var previewContainer = this.refs.remoteMedia
      this.attachParticipantTracks(participant, previewContainer)
    })

    // Attach participant’s tracks to DOM when they add a track
    room.on('trackAdded', (track, participant) => {
      console.log(participant.identity + ' added track: ' + track.kind)
      var previewContainer = this.refs.remoteMedia
      this.attachTracks([track], previewContainer)
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
      if (this.state.previewTracks) {
        this.state.previewTracks.forEach(track => {
          track.stop()
        })
      }
      this.detachParticipantTracks(room.localParticipant)
      room.participants.forEach(this.detachParticipantTracks)
      this.setState({ hasJoinedRoom: false, localMediaAvailable: false })
    })
  }


	render() {
		// Only show video track after user has joined a room
		let showLocalTrack = this.state.localMediaAvailable ? (
      <div className={styles.localMedia} ref="localMedia" />
		) : null
    
		return (
			<Layout overrideClassName={styles.container}>
        {showLocalTrack}
        <div className={styles.remoteMedia} ref="remoteMedia" id="remote-media" />
			</Layout>
		)
  }
}