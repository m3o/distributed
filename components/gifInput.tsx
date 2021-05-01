import { GifsResult, GiphyFetch } from '@giphy/js-fetch-api'
import React from 'react'
import 'reactjs-popup/dist/index.css'
import { getStripe } from '../lib/stripe'
import popupStyles from '../pages/groups/[id]/index.module.scss'
import styles from './gifInput.module.scss'

interface GifInputProps {
  onDismiss: Function
  groupId: string
  threadId: string
}

interface GifInputState {
  query: string
  result?: GifsResult
  selectedSlug?: string
  loading?: boolean
}

const gf = new GiphyFetch('lXFRs8N90qpxZlL2NtA1RJQBbdoZDNbp')

export default class GifInput extends React.Component<
  GifInputProps,
  GifInputState
> {
  constructor(props: GifInputProps) {
    super(props)
    this.state = { query: '' }
    this.onQueryChange = this.onQueryChange.bind(this)
    this.renderImage = this.renderImage.bind(this)
    this.onSend = this.onSend.bind(this)
  }

  onQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value || ''
    if (!query?.length) {
      this.setState({ query, result: undefined })
      gf.trending().then((result) => this.setState({ result }))
      return
    }

    this.setState({ query })
    gf.search(query).then((result) => this.setState({ result }))
  }

  componentDidMount() {
    gf.trending().then((result) => this.setState({ result }))
  }

  async onSend() {
    const image = this.state.result?.data?.find(
      (i) => i.slug === this.state.selectedSlug
    )
    if (!image) return

    this.setState({ loading: true })

    const body = JSON.stringify({
      groupId: this.props.groupId,
      imageURL: image.images.original.url,
      threadId: this.props.threadId,
    })
    const rsp = await fetch('/api/payments/checkoutSession', {
      method: 'POST',
      body,
    })
    const { id } = await rsp.json()

    const stripe = await getStripe()
    const result = await stripe.redirectToCheckout({ sessionId: id })

    if (result.error) {
      alert(`Error creating payment: ${result.error.message}`)
      this.setState({ loading: false })
    }
  }

  render() {
    const images = this.state.result?.data || []

    return (
      <div className={popupStyles.settingsContainer}>
        <div
          className={popupStyles.background}
          onClick={() => this.props.onDismiss()}
        />
        <div className={popupStyles.settings}>
          <h1>Send a Gif</h1>
          <div
            className={popupStyles.dismiss}
            onClick={() => this.props.onDismiss()}
          >
            <p>🔙</p>
          </div>

          <section className={styles.container}>
            <input
              autoFocus
              placeholder="Search"
              value={this.state.query}
              onChange={this.onQueryChange}
            />
            <div className={styles.results}>
              <div className={styles.row}>
                {images.filter((_, i) => i % 2 === 0).map(this.renderImage)}
              </div>

              <div className={styles.row}>
                {images.filter((_, i) => i % 2 === 1).map(this.renderImage)}
              </div>
            </div>

            {this.state.selectedSlug ? (
              <button disabled={this.state.loading} onClick={this.onSend}>
                Send gif
              </button>
            ) : null}
          </section>
        </div>
      </div>
    )
  }

  renderImage(i: any) {
    const selected = i.slug === this.state.selectedSlug
    const onClick = () =>
      this.setState({ selectedSlug: selected ? undefined : i.slug })
    return (
      <img
        className={selected ? styles.selected : ''}
        onClick={onClick}
        key={i.slug}
        src={i.images.preview_gif.url}
        alt={i.title}
      />
    )
  }
}
