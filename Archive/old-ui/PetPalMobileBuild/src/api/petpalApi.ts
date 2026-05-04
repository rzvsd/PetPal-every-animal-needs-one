import {
  ApplicationDraft,
  ApplicationStatus,
  ChatMessage,
  ConversationSummary,
  DiscoveryListing,
} from '../types/petpal';
import { supabase } from '../lib/supabase';

type DiscoveryListingRow = {
  listing_id: string;
  mode: 'ADOPT' | 'FOSTER';
  title: string;
  description: string;
  city: string;
  coarse_area: string | null;
  expires_at: string | null;
  animal_id: string;
  animal_name: string;
  species: 'DOG' | 'CAT';
  breed_or_mix: string | null;
  approximate_age_months: number | null;
  size_label: string | null;
  sex: 'FEMALE' | 'MALE' | 'UNKNOWN';
  temperament: string | null;
  public_health_summary: string | null;
  organization_id: string;
  organization_name: string;
  primary_photo_url: string | null;
};

type MyApplicationRow = {
  application_id: string;
  status: ApplicationStatus;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  listing_id: string;
  mode: 'ADOPT' | 'FOSTER';
  title: string;
  animal_name: string;
  species: 'DOG' | 'CAT';
  organization_name: string;
};

type ConversationRow = {
  conversation_id: string;
  application_id: string;
  application_status: ApplicationStatus;
  title: string;
  animal_name: string;
  organization_name: string;
  other_participants: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
};

type ChatMessageRow = {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_display_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
};

export type MyApplicationSummary = {
  applicationId: string;
  status: ApplicationStatus;
  title: string;
  animalName: string;
  organizationName: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export async function fetchDiscoveryListings(): Promise<DiscoveryListing[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('discovery_listings_view')
    .select('*')
    .order('animal_name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DiscoveryListingRow[]).map(mapDiscoveryListing);
}

export async function signInDemoAdopter() {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({
    email: 'adopter@petpal.local',
    password: 'petpal-demo-password',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signInDemoRescue() {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({
    email: 'rescue@petpal.local',
    password: 'petpal-demo-password',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function submitApplication(application: ApplicationDraft): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('submit_adoption_foster_application', {
    listing_id_input: application.listingId,
    housing_type_input: application.housingType,
    animal_experience_input: application.animalExperience,
    other_pets_input: application.otherPets,
    children_in_home_input: application.childrenInHome,
    landlord_approval_input: application.landlordApproval,
    motivation_input: application.motivation,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

export async function fetchMyApplications(): Promise<MyApplicationSummary[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('my_applications_view')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MyApplicationRow[]).map((row) => ({
    applicationId: row.application_id,
    status: row.status,
    title: row.title,
    animalName: row.animal_name,
    organizationName: row.organization_name,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
  }));
}

export async function reviewApplication(
  applicationId: string,
  status: Extract<ApplicationStatus, 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED'>,
  reviewNote: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('set_application_review_status', {
    application_id_input: applicationId,
    target_status_input: status,
    review_note_input: reviewNote,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchMyConversations(): Promise<ConversationSummary[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('my_conversations_view')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ConversationRow[]).map((row) => ({
    conversationId: row.conversation_id,
    applicationId: row.application_id,
    applicationStatus: row.application_status,
    title: row.title,
    animalName: row.animal_name,
    organizationName: row.organization_name,
    otherParticipants: row.other_participants,
    lastMessageBody: row.last_message_body,
    lastMessageAt: row.last_message_at,
  }));
}

export async function fetchConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('conversation_messages_view')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ChatMessageRow[]).map((row) => ({
    messageId: row.message_id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderDisplayName: row.sender_display_name,
    body: row.body,
    createdAt: row.created_at,
    isMine: row.is_mine,
  }));
}

export async function sendConversationMessage(
  conversationId: string,
  body: string,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('send_conversation_message', {
    conversation_id_input: conversationId,
    body_input: body,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

export async function reportMessage(
  messageId: string,
  category: string,
  details: string,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('report_message', {
    message_id_input: messageId,
    category_input: category,
    details_input: details,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

export async function blockProfile(profileId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('block_profile', {
    blocked_id_input: profileId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add Expo public Supabase env values first.');
  }

  return supabase;
}

function mapDiscoveryListing(row: DiscoveryListingRow): DiscoveryListing {
  return {
    listingId: row.listing_id,
    mode: row.mode,
    title: row.title,
    description: row.description,
    city: row.city,
    coarseArea: row.coarse_area,
    animalId: row.animal_id,
    animalName: row.animal_name,
    species: row.species,
    breedOrMix: row.breed_or_mix,
    approximateAgeMonths: row.approximate_age_months,
    sizeLabel: row.size_label,
    sex: row.sex,
    temperament: row.temperament,
    publicHealthSummary: row.public_health_summary,
    organizationName: row.organization_name,
    primaryPhotoUrl: row.primary_photo_url,
  };
}
