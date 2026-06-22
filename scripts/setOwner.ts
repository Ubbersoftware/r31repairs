/**
 * Grants the `owner` role to one or more existing accounts.
 *
 * The 3 owners must register in-app first, then run:
 *   FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" npm run set-owner -- owner1@x owner2@x
 *
 * The service-account JSON comes from Firebase console → Project settings →
 * Service accounts → Generate new private key. NEVER commit it.
 */
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
if (!sa.project_id) {
  console.error('FIREBASE_SERVICE_ACCOUNT is empty or invalid. See the comment at the top of this file.')
  process.exit(1)
}
initializeApp({ credential: cert(sa) })

async function main() {
  const emails = process.argv.slice(2)
  if (!emails.length) {
    console.error('Usage: npm run set-owner -- <email> [email...]')
    process.exit(1)
  }
  for (const email of emails) {
    const user = await getAuth().getUserByEmail(email)
    await getAuth().setCustomUserClaims(user.uid, { role: 'owner' })
    await getFirestore().doc(`r31_users/${user.uid}`).set({ role: 'owner' }, { merge: true })
    console.log(`Granted owner to ${email} (${user.uid})`)
  }
  console.log('Done. Affected users must sign out and back in to refresh their token.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
