import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const env = loadEnv()
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY')
}

const adopter = createClient(supabaseUrl, supabaseAnonKey)
const rescue = createClient(supabaseUrl, supabaseAnonKey)

await signIn(adopter, 'adopter@petpal.local')
await signIn(rescue, 'rescue@petpal.local')

const { data: listings, error: listingsError } = await adopter
  .from('discovery_listings_view')
  .select('*')
  .order('animal_name', { ascending: true })

if (listingsError) throw listingsError
if (!listings || listings.length < 2) {
  throw new Error(`Expected at least two approved discovery listings, got ${listings?.length ?? 0}`)
}

const listing = listings.find((row) => row.mode === 'FOSTER') ?? listings[0]

const { data: conversationsBefore, error: conversationsBeforeError } = await adopter
  .from('my_conversations_view')
  .select('*')
if (conversationsBeforeError) throw conversationsBeforeError

const submitResult = await adopter.rpc('submit_adoption_foster_application', {
  listing_id_input: listing.listing_id,
  housing_type_input: 'Apartment with a separate quiet foster room',
  animal_experience_input:
    'I have cared for rescue dogs and cats before, including slow introductions, medication routines, and foster handoffs.',
  other_pets_input: 'One calm adult cat, introductions handled slowly.',
  children_in_home_input: 'No children in the home.',
  landlord_approval_input: 'Written landlord approval available.',
  motivation_input:
    'This foster request is realistic because my work schedule is stable and I can coordinate veterinary visits during the pilot.',
})
if (submitResult.error) throw submitResult.error

const applicationId = submitResult.data

const { data: submittedApplication, error: submittedApplicationError } = await adopter
  .from('my_applications_view')
  .select('*')
  .eq('application_id', applicationId)
  .single()
if (submittedApplicationError) throw submittedApplicationError

const reviewResult = await rescue.rpc('set_application_review_status', {
  application_id_input: applicationId,
  target_status_input: 'ACCEPTED',
  review_note_input: 'M12 mobile E2E smoke accepted this applicant and opened gated chat.',
})
if (reviewResult.error) throw reviewResult.error

const { data: conversationsAfter, error: conversationsAfterError } = await adopter
  .from('my_conversations_view')
  .select('*')
  .eq('application_id', applicationId)
if (conversationsAfterError) throw conversationsAfterError

const conversation = conversationsAfter?.[0]
if (!conversation) {
  throw new Error('Accepted application did not open an adopter-visible conversation')
}

const rescueMessageResult = await rescue.rpc('send_conversation_message', {
  conversation_id_input: conversation.conversation_id,
  body_input: 'M12 smoke: rescue has accepted the application and is ready to coordinate.',
})
if (rescueMessageResult.error) throw rescueMessageResult.error

const adopterMessageResult = await adopter.rpc('send_conversation_message', {
  conversation_id_input: conversation.conversation_id,
  body_input: 'M12 smoke: adopter confirms availability for next steps.',
})
if (adopterMessageResult.error) throw adopterMessageResult.error

const { data: messages, error: messagesError } = await adopter
  .from('conversation_messages_view')
  .select('*')
  .eq('conversation_id', conversation.conversation_id)
  .order('created_at', { ascending: true })
if (messagesError) throw messagesError
if (!messages || messages.length < 2) {
  throw new Error(`Expected two gated chat messages, got ${messages?.length ?? 0}`)
}

const rescueMessage = messages.find((message) => message.sender_id === '10000000-0000-4000-8000-000000000001')
if (!rescueMessage) {
  throw new Error('Expected a rescue-authored message for report smoke')
}

const reportResult = await adopter.rpc('report_message', {
  message_id_input: rescueMessage.message_id,
  category_input: 'SAFETY_CONCERN',
  details_input: 'M12 mobile E2E smoke report from protected chat.',
})
if (reportResult.error) throw reportResult.error

const blockResult = await adopter.rpc('block_profile', {
  blocked_id_input: '10000000-0000-4000-8000-000000000001',
})
if (blockResult.error) throw blockResult.error

const { data: messagesAfterBlock, error: messagesAfterBlockError } = await adopter
  .from('conversation_messages_view')
  .select('*')
  .eq('conversation_id', conversation.conversation_id)
if (messagesAfterBlockError) throw messagesAfterBlockError

const { data: reportAfter, error: reportAfterError } = await rescue
  .from('reports')
  .select('id,status,reported_profile_id,message_id')
  .eq('id', reportResult.data)
  .single()
if (reportAfterError) throw reportAfterError

const result = {
  listingCount: listings.length,
  selectedListing: {
    id: listing.listing_id,
    mode: listing.mode,
    animal: listing.animal_name,
  },
  conversationsBefore: conversationsBefore?.length ?? 0,
  submittedApplication: {
    id: applicationId,
    status: submittedApplication.status,
  },
  acceptedConversation: {
    id: conversation.conversation_id,
    applicationStatus: conversation.application_status,
  },
  messageCountBeforeBlock: messages.length,
  report: {
    id: reportResult.data,
    status: reportAfter.status,
    reportedProfileId: reportAfter.reported_profile_id,
  },
  messagesVisibleAfterBlock: messagesAfterBlock?.length ?? 0,
}

console.log(JSON.stringify(result, null, 2))

await adopter.auth.signOut()
await rescue.auth.signOut()

async function signIn(client, email) {
  const { error } = await client.auth.signInWithPassword({
    email,
    password: 'petpal-demo-password',
  })

  if (error) throw error
}

function loadEnv() {
  try {
    const file = readFileSync(resolve('.env.local'), 'utf8')
    return Object.fromEntries(
      file
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const idx = line.indexOf('=')
          return [line.slice(0, idx), line.slice(idx + 1)]
        }),
    )
  } catch {
    return {}
  }
}
