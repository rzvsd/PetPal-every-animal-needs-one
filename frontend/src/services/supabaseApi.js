import { supabase, isSupabaseConfigured, demoSupabaseCredentials, authLinkHost } from './supabaseClient';

const fallbackFosterPhoto = 'https://images.unsplash.com/photo-1699727314431-36ab60fcc3e1?w=600&h=800&fit=crop';
const fallbackMatchPhoto = 'https://images.unsplash.com/photo-1642303009474-851f1dd5195f?w=600&h=800&fit=crop';

function normalizeSize(size) {
  if (!size) return 'MEDIUM';
  const normalized = String(size).toUpperCase();
  if (['SMALL', 'MEDIUM', 'LARGE'].includes(normalized)) return normalized;
  return 'MEDIUM';
}

function mapRole(role) {
  const roleMap = {
    ADOPTER: 'OWNER',
    FOSTER: 'FOSTER_VOLUNTEER',
    RESCUER: 'RESCUER',
    SHELTER_MEMBER: 'SHELTER_MEMBER',
  };

  return roleMap[role] || role;
}

function mapFosterCase(row) {
  return {
    id: row.listing_id,
    animalId: row.animal_id,
    animalName: row.animal_name,
    species: row.species,
    breed: row.breed_or_mix || '',
    ageMonths: row.approximate_age_months,
    sizeLabel: normalizeSize(row.size_label),
    title: row.title,
    description: row.description,
    status: 'ACTIVE',
    urgency: row.foster_urgency || 'MEDIUM',
    duration: row.foster_duration || 'UNKNOWN',
    foodCovered: Boolean(row.food_covered),
    vetCovered: Boolean(row.vet_covered),
    transportAvailable: Boolean(row.transport_available),
    goodWithChildren: row.good_with_children,
    goodWithOtherAnimals: row.good_with_other_animals,
    medicalNeeds: row.medical_needs || row.public_health_summary || null,
    homeFit: row.home_fit || row.description,
    city: row.city,
    coarseArea: row.coarse_area,
    exactLocationPrivate: 'hidden',
    rescuerName: row.organization_name,
    photoUrl: row.primary_photo_url || fallbackFosterPhoto,
    createdAt: new Date().toISOString(),
  };
}

function mapOwnerAnimal(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    species: row.species,
    breed: row.breed_or_mix || '',
    isMixedBreed: Boolean(row.is_mixed_breed),
    ageMonths: row.approximate_age_months,
    sex: row.sex || 'UNKNOWN',
    sizeLabel: normalizeSize(row.size_label),
    weightKg: row.weight_kg === null || row.weight_kg === undefined ? null : Number(row.weight_kg),
    sterilizedStatus: row.sterilized_status || 'UNKNOWN',
    vaccineStatus: row.vaccine_status || 'UNKNOWN',
    healthDocumentStatus: row.health_document_status || 'UNVERIFIED',
    adminMateApprovalStatus: row.admin_mate_approval_status || 'UNVERIFIED',
    temperamentTags: row.temperament_tags || [],
    energyLevel: row.energy_level || 'MEDIUM',
    goodWithDogs: row.good_with_dogs,
    goodWithCats: row.good_with_cats,
    goodWithChildren: row.good_with_children,
    city: row.city || '',
    coarseArea: row.coarse_area || '',
    photoUrls: row.photo_urls || [],
    activeMatchModes: row.active_match_modes || ['PLAY', 'SOCIAL'],
    profileCompleteness: row.profile_completeness || 0,
    verificationStatus: row.verification_status || 'UNVERIFIED',
  };
}

function mapMatchCandidate(row) {
  const animal = mapOwnerAnimal({
    id: row.animal_id,
    owner_id: row.owner_id,
    name: row.name,
    species: row.species,
    breed_or_mix: row.breed_or_mix,
    is_mixed_breed: row.is_mixed_breed,
    approximate_age_months: row.approximate_age_months,
    sex: row.sex,
    size_label: row.size_label,
    weight_kg: row.weight_kg,
    sterilized_status: row.sterilized_status,
    vaccine_status: row.vaccine_status,
    health_document_status: row.health_document_status,
    admin_mate_approval_status: row.admin_mate_approval_status,
    temperament_tags: row.temperament_tags,
    energy_level: row.energy_level,
    good_with_dogs: row.good_with_dogs,
    good_with_cats: row.good_with_cats,
    good_with_children: row.good_with_children,
    city: row.city,
    coarse_area: row.coarse_area,
    photo_urls: row.photo_urls?.length > 0 ? row.photo_urls : [fallbackMatchPhoto],
    active_match_modes: row.active_match_modes,
    profile_completeness: row.profile_completeness,
    verification_status: row.verification_status,
  });
  const preferredMode = animal.activeMatchModes?.includes('PLAY') ? 'PLAY' : animal.activeMatchModes?.[0] || 'SOCIAL';
  const verifiedOwner = row.owner_verification_status === 'VERIFIED';

  return {
    animal,
    mode: preferredMode,
    hasLikedBack: Boolean(row.has_liked_back),
    ownerVerificationStatus: verifiedOwner ? 'VERIFIED' : row.owner_verification_status || 'UNVERIFIED',
    healthDocumentStatus: animal.healthDocumentStatus,
    distanceLabel: `${animal.city || 'Romania'}${animal.coarseArea ? ` / ${animal.coarseArea}` : ''}`,
    exactLocationHidden: true,
  };
}

function mapPaymentSession(row) {
  return {
    id: row.id,
    provider: row.provider,
    purpose: row.purpose,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    checkoutUrl: row.checkout_url,
    providerSessionId: row.provider_session_id,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConversation(row, messages) {
  const conversationMessages = messages
    .filter((message) => message.conversation_id === row.conversation_id)
    .map((message) => ({
      messageId: message.message_id,
      senderDisplayName: message.sender_display_name,
      body: message.body,
      createdAt: message.created_at,
      isMine: message.is_mine,
      clientMessageId: message.client_message_id,
      sequence: message.message_seq,
      status: 'sent',
    }));

  const source = row.source === 'MATCH' ? 'MATCH' : 'FOSTER';
  const isMatch = source === 'MATCH';

  return {
    id: row.conversation_id,
    animalPhoto: animalPhotoUrl(row.animal_photo),
    otherOwnerName: row.other_owner_name,
    activityAt: row.activity_at,
    lastReadSequence: row.last_read_seq || 0,
    source,
    matchId: row.match_id,
    socialRequestStatus: row.social_request_status,
    socialRequestIsMine: Boolean(row.social_request_is_mine),
    fosterRequestId: row.foster_request_id,
    fosterReadOnly: Boolean(row.foster_read_only),
    fosterCaseId: row.listing_id,
    fosterApplicationId: row.application_id,
    fosterInviteId: row.foster_invite_id,
    title: isMatch ? `${row.animal_name} + ${row.related_animal_name}` : row.animal_name,
    subtitle: isMatch ? row.match_mode : row.application_status,
    contextLabel: isMatch
      ? 'This chat opened after a mutual match.'
      : 'Participants discuss a foster request. Receipt is declared separately.',
    privacyLabel: 'Exact location stays private.',
    animalName: row.animal_name,
    relatedAnimalName: row.related_animal_name,
    mode: row.match_mode,
    fosterStatus: row.application_status,
    organizationName: row.organization_name,
    city: row.city || '',
    coarseArea: row.coarse_area || '',
    otherParticipantIds: row.other_participant_ids || [],
    blocked: Boolean(row.messaging_blocked || row.blocked_by_me),
    // A placement chat stays readable after a block while the animal is in care.
    historyKept: Boolean(row.history_kept),
    reported: Boolean(row.reported_by_me),
    lastMessage: row.messaging_blocked && !row.history_kept ? '' : row.last_message_body || '',
    lastMessageAt: row.last_message_at || row.created_at,
    unread: row.unread_count || 0,
    messages: conversationMessages,
  };
}

function mapRescuerAccessState(row, roles = []) {
  if (roles.some((role) => ['RESCUER', 'SHELTER_MEMBER'].includes(role))) return 'verified';
  if (!row?.access_status || row.access_status === 'NOT_REQUESTED') return 'not_requested';
  if (row.access_status === 'PENDING') return 'request_sent';
  if (row.access_status === 'VERIFIED') return 'verified';
  if (row.access_status === 'REJECTED') return 'rejected';
  return 'not_requested';
}

export async function getSupabaseSession() {
  if (!isSupabaseConfigured) return null;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  return sessionData.session;
}

export async function signInWithSupabase(email, password) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signInWithDemoSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }
  if (!demoSupabaseCredentials.email || !demoSupabaseCredentials.password) {
    throw new Error('Demo credentials are not configured.');
  }

  const { data, error } = await supabase.auth.signInWithPassword(demoSupabaseCredentials);
  if (error) throw error;
  return data.session;
}

export async function signOutOfSupabase() {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function completeSupabaseProfile({
  displayName,
  city,
  coarseArea,
  roles = ['ADOPTER', 'FOSTER'],
  ageConfirmed = null,
  termsAccepted = null,
}) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc('complete_profile_onboarding', {
    display_name_input: displayName,
    city_input: city,
    coarse_area_input: coarseArea || null,
    roles_input: roles,
    age_confirmed_input: ageConfirmed,
    terms_accepted_input: termsAccepted,
  });

  if (error) throw error;
  return data;
}

export async function updateSupabaseProfile(profile) {
  return completeSupabaseProfile(profile);
}

export const defaultNotificationPreferences = { push: true, matches: true, foster: true, safety: true };

// Saved on the account; the server skips the push for a category that is off.
export async function updateSupabaseNotificationPreferences(preferences) {
  if (!isSupabaseConfigured) return { ...defaultNotificationPreferences, ...preferences };
  const { data, error } = await supabase.rpc('set_notification_preferences', { preferences_input: preferences });
  if (error) throw error;
  return { ...defaultNotificationPreferences, ...(data || {}) };
}

export async function updateSupabaseTypingPreference(enabled) {
  if (!isSupabaseConfigured) return Boolean(enabled);
  const { data, error } = await supabase.rpc('update_typing_preference', {
    enabled_input: Boolean(enabled),
  });
  if (error) throw error;
  return Boolean(data);
}

export async function setSupabaseConversationTyping(conversationId, isTyping) {
  const { data, error } = await supabase.rpc('set_conversation_typing', {
    conversation_id_input: conversationId,
    is_typing_input: Boolean(isTyping),
  });
  if (error) throw error;
  return Boolean(data);
}

export async function loadSupabaseConversationTyping(conversationId) {
  const { data, error } = await supabase.rpc('get_conversation_typing', {
    conversation_id_input: conversationId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object'
    ? { isTyping: Boolean(row.is_typing), updatedAt: row.updated_at || null }
    : { isTyping: Boolean(data), updatedAt: null };
}

export async function signUpWithSupabase({
  email,
  password,
  displayName,
  city,
  coarseArea,
  roles = ['ADOPTER', 'FOSTER'],
  ageConfirmed = false,
  termsAccepted = false,
}) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  // Consent travels in the sign-up metadata so onboarding can finish on first
  // sign-in when email confirmation delays the session.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        city,
        coarse_area: coarseArea,
        age_confirmed: ageConfirmed,
        terms_accepted: termsAccepted,
      },
    },
  });

  if (error) throw error;

  if (data.session) {
    await completeSupabaseProfile({ displayName, city, coarseArea, roles, ageConfirmed, termsAccepted });
  }

  return data.session;
}

async function loadProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const [
    { data: profile, error: profileError },
    { data: roles, error: rolesError },
    { data: accessRows, error: accessError },
  ] = await Promise.all([
    supabase.from('profiles').select('id, display_name, city, coarse_area, verification_status, show_typing_activity, notification_preferences').eq('id', userId).maybeSingle(),
    supabase.from('profile_roles').select('role').eq('profile_id', userId),
    supabase.from('my_rescuer_access_view').select('*').limit(1),
  ]);

  if (profileError) throw profileError;
  if (rolesError) throw rolesError;
  if (accessError) throw accessError;
  if (!profile) return null;

  const mappedRoles = (roles || []).map((item) => mapRole(item.role));
  const accessRow = accessRows?.[0] || null;

  return {
    id: profile.id,
    displayName: profile.display_name,
    city: profile.city || '',
    coarseArea: profile.coarse_area || '',
    roles: mappedRoles.length > 0 ? mappedRoles : ['OWNER'],
    ownerVerificationStatus: profile.verification_status || 'UNVERIFIED',
    rescuerAccessStatus: accessRow?.access_status || 'NOT_REQUESTED',
    rescuerAccessState: mapRescuerAccessState(accessRow, mappedRoles),
    rescuerAccessRequestId: accessRow?.request_id || null,
    rescuerOrganizationId: accessRow?.organization_id || null,
    showTypingActivity: profile.show_typing_activity !== false,
    notificationPreferences: { ...defaultNotificationPreferences, ...(profile.notification_preferences || {}) },
    email: userData.user.email || '',
    phone: userData.user.phone || '',
  };
}

async function loadFosterCases() {
  const { data, error } = await supabase
    .from('discovery_listings_view')
    .select('*')
    .eq('mode', 'FOSTER')
    .order('expires_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapFosterCase);
}

export async function loadMatchCandidates({ animalId, mode, filters = {}, savedOnly = false, afterId = null }) {
  const { data, error } = await supabase.rpc('discover_match_candidates', {
    my_animal_id_input: animalId, mode_input: mode, filters_input: filters,
    saved_only_input: savedOnly, after_id_input: afterId,
  });
  if (error) throw error;
  return (data || []).map(mapMatchCandidate);
}

async function loadMyAnimals() {
  const { data, error } = await supabase
    .from('my_animal_profiles_view')
    .select('*')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapOwnerAnimal);
}

export async function loadConversations({ source, before = null, id } = {}) {
  let query = supabase
    .from('conversation_inbox_view')
    .select('*')
    .order('activity_at', { ascending: false }).order('conversation_id', { ascending: false }).limit(20);
  if (source === 'MATCH') query = query.eq('source', 'MATCH');
  if (source === 'FOSTER') query = query.in('source', ['FOSTER', 'FOSTER_INVITE']);
  if (id) query = query.eq('conversation_id', id);
  if (before) query = query.or(`activity_at.lt.${before.activityAt},and(activity_at.eq.${before.activityAt},conversation_id.lt.${before.id})`);
  const { data: rows, error } = await query;
  if (error) throw error;
  return (rows || []).map((row) => mapConversation(row, []));
}

export async function loadConversationMessages(conversationId, { before, after } = {}) {
  let query = supabase.from('conversation_messages_view').select('*')
    .eq('conversation_id', conversationId).order('message_seq', { ascending: after !== undefined }).limit(50);
  if (before) query = query.lt('message_seq', before);
  if (after !== undefined) query = query.gt('message_seq', after);
  const { data, error } = await query;
  if (error) throw error;
  return mapConversation({ conversation_id: conversationId }, data || []).messages.sort((a, b) => a.sequence - b.sequence);
}

export async function loadSavedAnimals() {
  const { data, error } = await supabase.from('saved_animals').select('animal_id');
  if (error) throw error;
  return (data || []).map(row => row.animal_id);
}

export async function setAnimalSaved(animalId, saved) {
  const query = saved ? supabase.from('saved_animals').insert({ animal_id: animalId })
    : supabase.from('saved_animals').delete().eq('animal_id', animalId);
  const { error } = await query;
  if (error && !(saved && error.code === '23505')) throw error;
}

export async function findSocialWalkConversation(ownerId) {
  const { data, error } = await supabase.from('conversation_inbox_view').select('conversation_id')
    .eq('match_mode', 'SOCIAL').contains('other_participant_ids', [ownerId])
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data[0]?.conversation_id;
}

export async function requestSocialWalk(myAnimalId, targetAnimalId, body) {
  const { data, error } = await supabase.rpc('request_social_walk', {
    my_animal_id_input: myAnimalId, target_animal_id_input: targetAnimalId, body_input: body,
  });
  if (error) throw error;
  return data;
}

export async function respondSocialWalk(conversationId, accept) {
  const { data, error } = await supabase.rpc('respond_social_walk', {
    conversation_id_input: conversationId, accept_input: accept,
  });
  if (error) throw error;
  return data;
}

async function loadPaymentSessions() {
  const { data, error } = await supabase
    .from('payment_sessions')
    .select('id, provider, purpose, amount_cents, currency, status, checkout_url, provider_session_id, metadata, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data || []).map(mapPaymentSession);
}

// With email confirmation, sign-up returns no session, so the profile is
// created on first sign-in from the details and consent given at sign-up.
async function completeOnboardingFromSignUp(authUser) {
  const metadata = authUser?.user_metadata || {};
  if (!metadata.display_name) return;
  const { data, error } = await supabase.from('profiles').select('id').eq('id', authUser.id).maybeSingle();
  if (error) throw error;
  if (data) return;
  await completeSupabaseProfile({
    displayName: metadata.display_name,
    city: metadata.city,
    coarseArea: metadata.coarse_area,
    ageConfirmed: metadata.age_confirmed === true,
    termsAccepted: metadata.terms_accepted === true,
  });
}

export async function exportSupabaseData() {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return data;
}

export async function loadSupabaseDeletionBlockers() {
  const { data, error } = await supabase.rpc('my_account_deletion_blockers');
  if (error) throw error;
  return data;
}

// Resolves to { deleted: true } or, when open foster commitments block it,
// { deleted: false, blockers }.
export async function deleteSupabaseAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (!error) return data;
  const body = await error.context?.json?.().catch(() => null);
  if (body?.deleted === false) return body;
  throw error;
}

export async function loadSupabaseAppData() {
  if (!isSupabaseConfigured) {
    return { configured: false };
  }

  const session = await getSupabaseSession();
  if (session) await completeOnboardingFromSignUp(session.user);

  const fosterCases = await loadFosterCases();
  const [profile, myAnimals, matchCandidates, conversations, paymentSessions] = session
    ? await Promise.all([
        loadProfile(),
        loadMyAnimals(),
        Promise.resolve([]),
        loadConversations(),
        loadPaymentSessions(),
      ])
    : [null, [], [], [], []];

  return {
    configured: true,
    session,
    profile,
    myAnimals,
    matchCandidates,
    fosterCases,
    conversations,
    paymentSessions,
  };
}

export async function requestSupabaseRescuerAccess() {
  const { data, error } = await supabase.rpc('request_rescuer_access');
  if (error) throw error;
  return data;
}

export async function registerSupabasePushToken({
  token,
  platform = 'ANDROID',
  deviceId = null,
  appVersion = null,
}) {
  const { data, error } = await supabase.rpc('register_push_token', {
    token_input: token,
    platform_input: platform,
    device_id_input: deviceId,
    app_version_input: appVersion,
  });

  if (error) throw error;
  return data;
}

export async function disableSupabasePushToken(token) {
  const { error } = await supabase.rpc('disable_push_token', {
    token_input: token,
  });

  if (error) throw error;
}

export async function upsertSupabaseAnimalProfile(animal) {
  const { data, error } = await supabase.rpc('upsert_owner_animal_profile', {
    animal_id_input: animal.id || null,
    name_input: animal.name,
    species_input: animal.species,
    breed_or_mix_input: animal.breed || null,
    is_mixed_breed_input: Boolean(animal.isMixedBreed),
    approximate_age_months_input: animal.ageMonths === '' || animal.ageMonths === null || animal.ageMonths === undefined
      ? null
      : Number(animal.ageMonths),
    sex_input: animal.sex || 'UNKNOWN',
    size_label_input: animal.sizeLabel || null,
    weight_kg_input: animal.weightKg === '' || animal.weightKg === null || animal.weightKg === undefined
      ? null
      : Number(animal.weightKg),
    sterilized_status_input: animal.sterilizedStatus || 'UNKNOWN',
    vaccine_status_input: animal.vaccineStatus || 'UNKNOWN',
    temperament_tags_input: animal.temperamentTags || [],
    energy_level_input: animal.energyLevel || null,
    good_with_dogs_input: animal.goodWithDogs ?? null,
    good_with_cats_input: animal.goodWithCats ?? null,
    good_with_children_input: animal.goodWithChildren ?? null,
    city_input: animal.city || null,
    coarse_area_input: animal.coarseArea || null,
    photo_urls_input: animal.photoUrls || [],
    active_match_modes_input: animal.activeMatchModes?.length > 0 ? animal.activeMatchModes : ['PLAY', 'SOCIAL'],
  });

  if (error) throw error;
  return mapOwnerAnimal(data);
}

export async function deleteSupabaseAnimalProfile(animalId) {
  const { error } = await supabase.rpc('delete_owner_animal_profile', {
    animal_id_input: animalId,
  });

  if (error) throw error;
}

function getSafeStorageFileName(file) {
  const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
  const baseName = file.name
    ?.replace(/\.[^/.]+$/, '')
    ?.toLowerCase()
    ?.replace(/[^a-z0-9]+/g, '-')
    ?.replace(/^-|-$/g, '') || 'animal-photo';

  return `${Date.now()}-${baseName}.${extension}`;
}

// Returns the storage path (<ownerId>/<animalId>/<file>). Foster records store
// this path; the database accepts only the uploader's own files.
export async function uploadSupabaseAnimalPhotoPath({ ownerId, animalId, file }) {
  if (!ownerId || !animalId || !file) {
    throw new Error('Missing animal photo upload details.');
  }

  const filePath = `${ownerId}/${animalId}/${getSafeStorageFileName(file)}`;
  const { error } = await supabase.storage
    .from('animal-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;
  return filePath;
}

// Turns a stored photo value into a displayable URL. Older records hold full URLs.
export function animalPhotoUrl(value) {
  if (!value || /^(https?:|blob:|data:)/.test(value) || !supabase) return value;
  return supabase.storage.from('animal-photos').getPublicUrl(value).data.publicUrl;
}

export async function uploadSupabaseAnimalPhoto({ ownerId, animalId, file }) {
  const filePath = await uploadSupabaseAnimalPhotoPath({ ownerId, animalId, file });
  const { data } = supabase.storage.from('animal-photos').getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error('Animal photo was uploaded, but no public URL was returned.');
  }

  return data.publicUrl;
}

export async function submitSupabaseFosterApplication(caseId, formData) {
  const { data, error } = await supabase.rpc('submit_adoption_foster_application', {
    listing_id_input: caseId,
    housing_type_input: formData.housingType,
    animal_experience_input: formData.experience,
    other_pets_input: formData.otherPets,
    children_in_home_input: formData.childrenInHome,
    landlord_approval_input: formData.canTransport ? 'Can transport' : 'Cannot transport',
    motivation_input: formData.motivation,
  });

  if (error) throw error;
  return data;
}

export async function likeSupabaseMatchCandidate(myAnimalId, targetAnimalId, mode) {
  const { data, error } = await supabase.rpc('like_match_candidate', {
    my_animal_id_input: myAnimalId,
    target_animal_id_input: targetAnimalId,
    mode_input: mode,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function createSupabasePaymentSession({
  provider = 'STRIPE',
  purpose = 'DONATION',
  amountCents,
  currency = 'RON',
  metadata = {},
}) {
  const { data, error } = await supabase.functions.invoke('create-payment-session', {
    body: {
      provider,
      purpose,
      amountCents,
      currency,
      metadata,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  const session = data?.paymentSession || data;
  return session?.amount_cents ? mapPaymentSession(session) : session;
}

export async function sendSupabaseConversationMessage(conversationId, body, clientMessageId) {
  const { data, error } = await supabase.rpc('send_conversation_message', {
    conversation_id_input: conversationId,
    body_input: body,
    client_message_id_input: clientMessageId,
  }).abortSignal(AbortSignal.timeout(12000));

  if (error) throw error;
  return data;
}

export async function passSupabaseCandidate({ myAnimalId, targetAnimalId, mode }) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('match_passes').insert({
    profile_id: userData.user?.id,
    my_animal_id: myAnimalId,
    target_animal_id: targetAnimalId,
    mode,
  });
  // A repeated pass is already stored.
  if (error && error.code !== '23505') throw error;
}

export async function reportSupabaseMatchProfile({ ownerId, animalId }) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('reports').insert({
    reporter_id: userData.user?.id,
    reported_profile_id: ownerId,
    category: 'MATCH_PROFILE',
    details: `Reported from Animal Match (animal ${animalId}).`,
  });
  if (error) throw error;
}

export async function blockSupabaseProfile(profileId) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('blocks').insert({ blocker_id: userData.user?.id, blocked_id: profileId });
  if (error && error.code !== '23505') throw error;
}

export async function loadSupabaseBlockedProfiles() {
  const { data, error } = await supabase.rpc('my_blocked_profiles');
  if (error) throw error;
  return (data || []).map(row => ({ id: row.blocked_id, displayName: row.display_name, createdAt: row.created_at }));
}

export async function unblockSupabaseProfile(profileId) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('blocks').delete().match({ blocker_id: userData.user?.id, blocked_id: profileId });
  if (error) throw error;
}

// Password reset. On the phone the email link is an https App Link
// (https://<REACT_APP_AUTH_LINK_HOST>/reset) that Android hands only to the
// verified PetPal app; the web build comes back to its own origin. Either way
// the link carries a one-time PKCE code, never session tokens.
export const PASSWORD_RESET_PATH = '/reset';

export function passwordResetLink(host = authLinkHost) {
  return host ? `https://${host}${PASSWORD_RESET_PATH}` : '';
}

export function isPasswordResetLink(url, host = authLinkHost) {
  if (!url || !host) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:'
      && parsed.hostname.toLowerCase() === host
      && parsed.pathname.replace(/\/+$/, '') === PASSWORD_RESET_PATH;
  } catch {
    return false;
  }
}

export async function requestSupabasePasswordReset(email, native) {
  const redirectTo = native ? passwordResetLink() : window.location.origin;
  if (!redirectTo) throw new Error('Password reset links are not configured for this build.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// Exchanges the one-time code in the reset link for a session. This only
// works on the device that requested the link, because the PKCE verifier
// never leaves it. Links that carry tokens directly are refused. Resolves
// false when the link carries no code at all.
export async function openSupabaseRecoveryLink(url) {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const errorDescription = parsed.searchParams.get('error_description') || hash.get('error_description');
  if (errorDescription) throw new Error(errorDescription);
  const code = parsed.searchParams.get('code');
  if (!code) return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}

export async function updateSupabasePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function reportSupabaseConversation(conversationId, details = '') {
  const { data, error } = await supabase.rpc('report_conversation', {
    conversation_id_input: conversationId,
    category_input: 'CONVERSATION_SAFETY',
    details_input: details,
  });

  if (error) throw error;
  return data;
}

export async function blockSupabaseConversation(conversationId) {
  const { data, error } = await supabase.rpc('block_conversation', {
    conversation_id_input: conversationId,
  });

  if (error) throw error;
  return data;
}
