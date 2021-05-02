import classNames from 'classnames'
import moment from 'moment'
import {
  Component,
  createRef,
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState
} from 'react'
import Twilio, { LocalParticipant, RemoteParticipant } from 'twilio-video'
import { User } from '../lib/user'
import { getVideoProfile, VideoProfile } from '../lib/videos'
import styles from './stream.module.scss'

interface StreamProps {
  // className which can be optionally provided to add additonal styling to the stream component
  className?: string
  // the room id is used as the identifier for the twilio video call
  roomId: string
  // the participants in the stream, this is used to add labels to the stream such as user name etc
  participants: User[]
  // whether video is enabled
  enabledVideo: boolean
  setEnabledVideo: Dispatch<SetStateAction<boolean>>
  // whether audio is enabled
  enabledAudio: boolean
  setEnabledAudio: Dispatch<SetStateAction<boolean>>
}

interface ParticipantStream {
  // participant id
  participant: User
  // the time at which the user connected to the stream, this is used to sequence the participants
  // in the user interface, ensuring new users are added to the end of the list
  connectedAt?: string
  // the connection object containing links to the various media tracks
  connection?: LocalParticipant | RemoteParticipant
}

function participantStreamComparator(
  a: ParticipantStream,
  b: ParticipantStream
): number {
  return moment(a.connectedAt).isBefore(b.connectedAt) ? -1 : 1
}

const Stream = ({
  className,
  roomId,
  participants,
  enabledVideo,
  enabledAudio,
}: StreamProps) => {
  const [streamsById, setStreamsById] = useState<
    Record<string, ParticipantStream>
  >({})
  const [videoProfile, setVideoProfile] = useState<VideoProfile>()
  const [connecting, setConnecting] = useState<boolean>(false)
  const [room, setRoom] = useState<any>()

  const participantsById: Record<string, User> = (participants || []).reduce(
    (result, user) => ({ ...result, [user.id]: { user } }),
    {}
  )

  const attachTracks = (tracks: any[]) => {
    tracks.forEach((t) => {
      if (t.isSubscribed) {
        console.log('already subscribed to: ', t.trackName)
        return
      }

      // handle local track which does not get subscribed to
      if (t.track) {
        t.track.attach().muted = true
        return
      }
    })
  }

  const onRoomJoined = (room) => {
    console.log(`Twilio(room=${roomId}) Joined room`)

    setRoom(room)
    setConnecting(false)

    // Attach LocalParticipant's tracks
    const tracks = Array.from(room.localParticipant.tracks.values())
    attachTracks(tracks)

    // Attach the tracks of the room's participants.
    const newStreamsById = {}

    newStreamsById[videoProfile.identity] = {
      participant: participantsById[videoProfile.identity],
      connection: room.localParticipant,
      connectedAt: new Date().toISOString(),
    }
    room.participants.forEach((participant) => {
      console.log(
        `Twilio(room=${roomId}) Participant(id=${participant.identity}) already in room`
      )

      const tracks = Array.from(participant.tracks.values())
      attachTracks(tracks)

      newStreamsById[participant.identity] = {
        participant: participantsById[participant.identity],
        connection: participant,
        connectedAt: new Date().toISOString(),
      }
    })

    setStreamsById(newStreamsById)

    // Participant joining room
    room.on('participantConnected', (participant) => {
      console.log(
        `Twilio(room=${roomId}) Participant(id=${participant.identity}) joining room`
      )
      const tracks = Array.from(participant.tracks.values())
      attachTracks(tracks)
      setStreamsById((c) => ({
        ...c,
        [participant.identity]: {
          ...c[participant.identity],
          participant: participantsById[participant.identity],
          connectedAt: new Date().toISOString(),
          connection: participant,
        },
      }))
    })

    // Attach participant’s tracks to DOM when they add a track
    room.on('trackAdded', (track, participant) => {
      console.log(
        `Twilio(room=${roomId}) Participant(id=${participant.identity}) added track ${track.kind}`
      )
      attachTracks([track])
    })

    // Detach all participant’s track when they leave a room.
    room.on('participantDisconnected', (participant) => {
      console.log(
        `Twilio(room=${roomId}) Participant(id=${participant.identity}) left room`
      )
      setStreamsById((c) => ({
        ...c,
        [participant.identity]: {
          ...c[participant.identity],
          participant: participantsById[participant.identity],
          connected: false,
          connectedAt: undefined,
        },
      }))
    })
  }

  const disconnectTwilio = () => {
    if (!room) return
    console.log(`Twilio(room=${roomId}) Leaving room...`)
    room.disconnect()
    setRoom(undefined)
  }

  useEffect(() => {
    const fetchVideoProfile = async () => {
      try {
        const profile = await getVideoProfile()
        setVideoProfile(profile)
      } catch (e) {
        alert(`Error loading video credentials: ${e}`)
      }
    }
    fetchVideoProfile()

    return disconnectTwilio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!videoProfile || !videoProfile.token) return
    if (connecting) return

    const connectTwilio = async () => {
      try {
        const r = await Twilio.connect(videoProfile.token, {
          name: roomId,
          tracks: [],
        })
        onRoomJoined(r)
      } catch (e) {
        alert('Could not connect to Twilio: ' + e.message)
      }
    }
    connectTwilio()

    return disconnectTwilio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, videoProfile, connecting])

  useEffect(() => {
    if (!videoProfile?.token) return
    if (!room) return
    if (!enabledVideo) return
    if (Array.from(room.localParticipant.videoTracks).length !== 0) return

    const publishVideoTrack = async () => {
      const track = await Twilio.createLocalVideoTrack()
      await room.localParticipant.publishTrack(track)
    }
    publishVideoTrack()
  }, [roomId, enabledVideo, videoProfile, room])

  useEffect(() => {
    if (!videoProfile?.token) return
    if (!room) return
    if (enabledVideo) return
    if (Array.from(room.localParticipant.videoTracks).length === 0) return

    const disconnectLocalVideoTrack = async () => {
      Array.from(room.localParticipant.videoTracks)
        .map((t) => t[1].track)
        .forEach((t) => {
          t.stop()
          room.localParticipant.unpublishTrack(t)
        })
    }
    disconnectLocalVideoTrack()
  }, [roomId, enabledVideo, videoProfile, room])

  useEffect(() => {
    if (!videoProfile?.token) return
    if (!room) return
    if (!enabledAudio) return
    if (Array.from(room.localParticipant.audioTracks).length !== 0) return

    const connectLocalAudioTrack = async () => {
      const tracks = [await Twilio.createLocalAudioTrack()]
      twilioConnect(roomId, videoProfile.token, tracks)
    }
    connectLocalAudioTrack()
  }, [roomId, enabledAudio, videoProfile, room])

  useEffect(() => {
    if (!videoProfile?.token) return
    if (!room) return
    if (enabledAudio) return
    if (Array.from(room.localParticipant.audioTracks).length === 0) return

    const disconnectLocalAudioTrack = async () => {
      Array.from(room.localParticipant.audioTracks)
        .map((t) => t[1].track)
        .forEach((t) => {
          t.stop()
          room.localParticipant.unpublishTrack(t)
        })
    }
    disconnectLocalAudioTrack()
  }, [roomId, enabledAudio, videoProfile, room])

  const streams = useMemo(
    () => Object.values(streamsById).sort(participantStreamComparator),
    [streamsById]
  )

  return (
    <div className={classNames(className, styles.container)}>
      {streams.map((s) => {
        return (
          <ParticipantComponent
            key={s.participant.id}
            participantStream={s}
            muted={s.participant.id === 'identity'}
            enabledVideo={false}
            setEnabledVideo={() => {}}
            enabledAudio={false}
            setEnabledAudio={() => {}}
          />
        )
      })}
    </div>
  )
}

export default Stream

interface ParticipantProps {
  muted: boolean
  participantStream: ParticipantStream
  // whether video is enabled
  enabledVideo: boolean
  setEnabledVideo: Dispatch<SetStateAction<boolean>>
  // whether audio is enabled
  enabledAudio: boolean
  setEnabledAudio: Dispatch<SetStateAction<boolean>>
}

class ParticipantComponent extends Component<ParticipantProps> {
  readonly state: {
    size?: number
  }
  readonly videoRef = createRef<HTMLVideoElement>()
  readonly audioRef = createRef<HTMLAudioElement>()

  constructor(props: ParticipantProps) {
    super(props)
    this.state = { size: 0 }
    this.onClick = this.onClick.bind(this)
    this.connectTrack = this.connectTrack.bind(this)
    this.disconnectTrack = this.disconnectTrack.bind(this)
  }

  // connect the audio/video source to the participants media track
  connectTrack(x: any) {
    if (!x.track && !x.attach) return

    try {
      console.log(
        'connect',
        x.kind,
        x.attach().srcObject,
        this.videoRef.current
      )

      if (x.kind === 'audio') {
        this.props.setEnabledAudio(true)
        this.audioRef.current.srcObject = x.track
          ? x.track.attach().srcObject
          : x.attach().srcObject
      } else {
        this.props.setEnabledVideo(true)
        this.videoRef.current.srcObject = x.track
          ? x.track.attach().srcObject
          : x.attach().srcObject
      }
    } catch (error) {
      console.warn(error)
    }
  }

  // the participant has stopped publishing a track, disconnect from it
  disconnectTrack(x: any) {
    if (x.kind === 'audio') {
      this.audioRef.current.srcObject = undefined
      this.props.setEnabledAudio(false)
    } else {
      this.videoRef.current.srcObject = undefined
      this.props.setEnabledVideo(false)
    }
  }

  componentDidMount() {
    // the local participant should be muted (you don't need to hear yourself)
    this.audioRef.current.muted = this.props.muted
    this.videoRef.current.muted = this.props.muted

    this.props.participantStream.connection.tracks.forEach(this.connectTrack)
    this.props.participantStream.connection.on(
      'trackStarted',
      this.connectTrack
    )
    this.props.participantStream.connection.on(
      'trackStopped',
      this.disconnectTrack
    )
    this.props.participantStream.connection.on(
      'trackUnpublished',
      this.disconnectTrack
    )
  }

  componentDidUpdate(prevProps: ParticipantProps) {
    if (prevProps.muted !== this.props.muted) {
      this.audioRef.current.muted = this.props.muted
      this.videoRef.current.muted = this.props.muted
    }
  }

  // make the UI bigger when the participant is clicked. There are 3 sizes: small, medium and large.
  // when the user clicks on the large UI, it circles back to the small UI.
  onClick(): void {
    let size = this.state.size + 1
    if (size > 2) size = 0
    this.setState({ size })
  }

  render(): JSX.Element {
    const { participantStream, enabledVideo, enabledAudio } = this.props
    const sizeStyle = { 0: styles.small, 1: styles.medium, 2: styles.large }[
      this.state.size
    ]

    // Note: do not set muted when rendering the video / audio components:
    // https://github.com/facebook/react/issues/10389
    return (
      <div
        className={classNames(styles.participant, sizeStyle)}
        onClick={this.onClick}
      >
        <audio autoPlay playsInline ref={this.audioRef} />
        <video
          style={enabledVideo ? {} : { display: 'none' }}
          autoPlay
          playsInline
          ref={this.videoRef}
        />
        {enabledVideo ? null : (
          <p>{participantStream.participant.first_name}</p>
        )}
        {enabledVideo ? null : (
          <p className={styles.icons}>
            {enabledAudio ? <span>🎤</span> : null}
            {enabledVideo ? <span>🎥</span> : null}
          </p>
        )}
      </div>
    )
  }
}
