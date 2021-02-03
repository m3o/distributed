import moment from 'moment'
import Linkify from 'react-linkify'
import { Message as Msg } from '../lib/message'
import styles from './message.module.scss'

interface Props {
  data: Msg;
}

export default function Message({ data }: Props) {
  return <div className={data.author.current_user ? [styles.container, styles.isAuthor].join(' ') : styles.container}>
    <div className={styles.upper}>
      <p className={styles.author}>{ data.author.first_name } {data.author.last_name }</p>
      <p className={styles.sentAt}><time dateTime={data.sent_at}>{ moment(data.sent_at).format('LT') }</time></p>
    </div>
    <p className={styles.text}><Linkify >{ data.text }</Linkify></p>
  </div>
}