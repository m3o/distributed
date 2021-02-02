// Frameworks
import { Component, createRef } from 'react'
import Stream from '../../components/stream'

// Styling
import styles from './video.module.scss'

interface Props {
  id: string
}

export default class VideoComponent extends Component<Props> {
  readonly localMedia = createRef<HTMLDivElement>()
  readonly remoteMedia = createRef<HTMLDivElement>()

  static async getInitialProps ({ query }) {
    return { id: query.id }
  }

	render() {
		return (
			<div className={styles.container}>
        <div className={styles.localMedia} ref={this.localMedia} />
        <div className={styles.remoteMedia} ref={this.remoteMedia} />

        <Stream
          audio={true}
          video={true}
          roomID={this.props.id}
          localMediaRef={this.localMedia}
          remoteMediaRef={this.remoteMedia} />
			</div>
		)
  }
}