import { supabase, isSupabaseConfigured, demoSupabaseCredentials } from './supabaseClient';

const fallbackFosterPhoto = 'https://images.unsplash.com/photo-1699727314431-36ab60fcc3e1?w=600&h=800&fit=crop';

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
    rescuerVerified: row.organization_verification_status === 'VERIFIED',
    photoUrl: row.primary_photo_url || fallbackFosterPhoto,
    createdAt: new Date().toISOString(),
  };
}

function mapApplication(row) {
  return {
    id: row.application_id,
    fosterCaseId: row.listing_id,
    animalName: row.animal_name,
    rescuerName: row.organization_name,
    applicantId: 'supabase-user',
    status: row.status,
    housingType: row.housing_type || '',
    availability: '',
    experience: row.animal_experience || '',
    otherPets: row.other_pets || '',
    childrenInHome: row.children_in_home || '',
    canTransport: null,
    canHandleMedicalNeeds: null,
    motivation: row.motivation || '',
    createdAt: row.created_at,
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

function mapConversation(row, messages) {
  const conversationMessages = messages
    .filter((message) => message.conversation_id === row.conversation_id)
    .map((message) => ({
      messageId: message.message_id,
      senderDisplayName: message.sender_display_name,
      body: message.body,
      createdAt: message.created_at,
      isMine: message.is_mine,
    }));

  return {
    id: row.conversation_id,
    source: 'FOSTER',
    fosterCaseId: row.listing_id,
    fosterApplicationId: row.application_id,
    title: row.animal_name,
    subtitle: 'Application accepted',
    contextLabel: 'This chat opened after the foster request was accepted.',
    privacyLabel: 'Exact location stays private.',
    animalName: row.animal_name,
    fosterStatus: row.application_status,
    organizationName: row.organization_name,
    organizationVerified: row.organization_verification_status === 'VERIFIED',
    city: row.city || '',
    coarseArea: row.coarse_area || '',
    otherParticipantIds: row.other_participant_ids || [],
    blocked: Boolean(row.blocked_by_me),
    reported: Boolean(row.reported_by_me),
    lastMessage: row.last_message_body || '',
    lastMessageAt: row.last_message_at || row.created_at,
    unread: 0,
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
}) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc('complete_profile_onboarding', {
    display_name_input: displayName,
    city_input: city,
    coarse_area_input: coarseArea || null,
    roles_input: roles,
  });

  if (error) throw error;
  return data;
}

export async function updateSupabaseProfile(profile) {
  return completeSupabaseProfile(profile);
}

export async function signUpWithSupabase({
  email,
  password,
  displayName,
  city,
  coarseArea,
  roles = ['ADOPTER', 'FOSTER'],
}) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        city,
        coarse_area: coarseArea,
      },
    },
  });

  if (error) throw error;

  if (data.session) {
    await completeSupabaseProfile({ displayName, city, coarseArea, roles });
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
    supabase.from('profiles').select('id, display_name, city, coarse_area, verification_status').eq('id', userId).maybeSingle(),
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

async function loadApplications() {
  const { data, error } = await supabase
    .from('my_applications_view')
    .select('*')
    .eq('mode', 'FOSTER')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapApplication);
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

async function loadConversations() {
  const { data: rows, error } = await supabase
    .from('my_conversations_view')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  const conversationIds = (rows || []).map((row) => row.conversation_id);
  if (conversationIds.length === 0) return [];

  const { data: messages, error: messagesError } = await supabase
    .from('conversation_messages_view')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (messagesError) throw messagesError;
  return rows.map((row) => mapConversation(row, messages || []));
}

export async function loadSupabaseAppData() {
  if (!isSupabaseConfigured) {
    return { configured: false };
  }

  const session = await getSupabaseSession();

  const fosterCases = await loadFosterCases();
  const [profile, myAnimals, fosterApplications, conversations] = session
    ? await Promise.all([
        loadProfile(),
        loadMyAnimals(),
        loadApplications(),
        loadConversations(),
      ])
    : [null, [], [], []];

  return {
    configured: true,
    session,
    profile,
    myAnimals,
    fosterCases,
    fosterApplications,
    conversations,
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

export async function uploadSupabaseAnimalPhoto({ ownerId, animalId, file }) {
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

export async function sendSupabaseConversationMessage(conversationId, body) {
  const { data, error } = await supabase.rpc('send_conversation_message', {
    conversation_id_input: conversationId,
    body_input: body,
  });

  if (error) throw error;
  return data;
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
