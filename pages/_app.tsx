import '../styles/global.css'

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    videoEnabled?: Boolean
    audioEnabled?: Boolean
  }
}

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
