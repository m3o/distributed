import '../styles/global.css'

declare global {
  interface Window {
    videoEnabled?: Boolean
    audioEnabled?: Boolean
  }
}

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
