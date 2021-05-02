import { useCallback, useEffect, useRef } from 'react'
import Twilio, {
  LocalTrackPublication,
  RemoteParticipant,
  RemoteTrackPublication,
  Room
} from 'twilio-video'
import { getVideoProfile, VideoProfile } from '../lib/videos'

const TWILIO_RECONNECT_TIMEOUT_INITIAL = 2 * 1000
const TWILIO_RECONNECT_TIMEOUT_MAX = 5 * 60 * 1000

const calculateTimeout = (prevTimeout) =>
  Math.min(prevTimeout * 2, TWILIO_RECONNECT_TIMEOUT_MAX)

interface StreamUIProps {
  // the room id is used as the identifier for the twilio video call
  roomId: string
}

const StreamUI = ({ roomId }: StreamUIProps) => {
  const videoProfile = useRef<VideoProfile>()
  const twilioRoom = useRef<Room>()
  const reconnectTimer = useRef<NodeJS.Timeout>()
  const reconnectTimeout = useRef<number>(TWILIO_RECONNECT_TIMEOUT_INITIAL)

  const attachLocalTracks = (tracks: LocalTrackPublication[]) => {
    console.log('AAA - attachLocalTracks tracks', tracks)
  }

  const attachRemoteTracks = (tracks: RemoteTrackPublication[]) => {
    console.log('AAA - attachRemoteTracks tracks', tracks)
  }

  const onTwilioRoomConnected = useCallback(
    (room) => {
      // LocalParticipant in room
      const tracks = Array.from(room.localParticipant.tracks.values())
      attachLocalTracks(tracks as LocalTrackPublication[])
      //const newStreamsById = {}
      //newStreamsById[videoProfile.identity] = {
      //  participant: participantsById[videoProfile.identity],
      //  connection: room.localParticipant,
      //  connectedAt: new Date().toISOString(),
      //}

      // RemoteParticipant already in room
      for (const p of room.participants || []) {
        console.log(
          `Twilio(room=${roomId}) Participant(id=${p.identity}) already in room`
        )
        const tracks = Array.from(p.tracks.values())
        attachRemoteTracks(tracks as RemoteTrackPublication[])

        //newStreamsById[participant.identity] = {
        //  participant: participantsById[participant.identity],
        //  connection: participant,
        //  connectedAt: new Date().toISOString(),
        //}
      }

      //setStreamsById(newStreamsById)

      // RemoteParticipant joined room
      room.on('participantConnected', (p: RemoteParticipant) => {
        console.log(
          `Twilio(room=${roomId}) Participant(id=${p.identity}) joined room`
        )
        const tracks = Array.from(p.tracks.values())
        attachRemoteTracks(tracks as RemoteTrackPublication[])
        //setStreamsById((c) => ({
        //  ...c,
        //  [p.identity]: {
        //    ...c[p.identity],
        //    participant: participantsById[p.identity],
        //    connectedAt: new Date().toISOString(),
        //    connection: p,
        //  },
        //}))
      })

      // RemoteParticipant adding track
      room.on('trackAdded', (track, participant) => {
        console.log(
          `Twilio(room=${roomId}) Participant(id=${participant.identity}) added track ${track.kind}`
        )
        attachRemoteTracks([track])
      })

      // RemoteParticipant leaving room
      room.on('participantDisconnected', (participant) => {
        console.log(
          `Twilio(room=${roomId}) Participant(id=${participant.identity}) left room`
        )
        //setStreamsById((c) => ({
        //  ...c,
        //  [participant.identity]: {
        //    ...c[participant.identity],
        //    participant: participantsById[participant.identity],
        //    connected: false,
        //    connectedAt: undefined,
        //  },
        //}))
      })
    },
    [roomId]
  )

  const fetchVideoProfile = useCallback(async () => {
    if (videoProfile.current) return

    try {
      videoProfile.current = await getVideoProfile()
      console.log('Video Profile credentials loaded')
    } catch (e) {
      console.log(`Video Profile credentials failed to load - ${e}`)
      throw e
    }
  }, [])

  const disconnectTwilioRoom = useCallback(() => {
    if (!twilioRoom.current) return

    try {
      if (twilioRoom.current?.disconnect) twilioRoom.current.disconnect()
      twilioRoom.current = undefined
      console.log(`Twilio(roomId=${roomId}) disconnected from room`)
    } catch (e) {
      console.log(
        `Twilio(roomId=${roomId}) failed disconnecting from room - ${e}`
      )
      throw e
    }
  }, [roomId])

  const connectTwilioRoom = useCallback(async () => {
    if (!videoProfile.current?.token) return
    if (twilioRoom.current?.state === 'connected') return

    try {
      twilioRoom.current = await Twilio.connect(videoProfile.current.token, {
        name: roomId,
        tracks: [],
      })
      console.log(`Twilio(roomId=${roomId}) connected to room`)
      onTwilioRoomConnected(twilioRoom.current)
    } catch (e) {
      console.log(`Twilio(roomId=${roomId}) failed connecting to room - ${e}`)
      throw e
    }
  }, [roomId, onTwilioRoomConnected])

  const setupStream = useCallback(async () => {
    try {
      await fetchVideoProfile()
      if (twilioRoom.current?.state !== 'connected') disconnectTwilioRoom()
      await connectTwilioRoom()
    } catch (e) {
      console.log(
        `Twilio(roomId=${roomId}) reconnecting to room in ${reconnectTimeout.current} ms`
      )
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = setTimeout(setupStream, reconnectTimeout.current)
      reconnectTimeout.current = calculateTimeout(reconnectTimeout.current)
    }
  }, [roomId, fetchVideoProfile, disconnectTwilioRoom, connectTwilioRoom])

  useEffect(() => {
    setupStream()
    return disconnectTwilioRoom
  }, [setupStream, disconnectTwilioRoom])

  // console.log('AAA - videoProfile', videoProfile)
  // console.log('AAA - twilioRoom', twilioRoom)

  return <>STREAM</>
}

export default StreamUI
