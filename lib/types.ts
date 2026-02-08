export type Space = {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string;
  address: string | null;
  org_type: string | null;
  created_by: string;
  created_at: string;
};

export type SpaceEvent = {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  event_time: string | null;
  location: string | null;
  created_by: string | null;
  created_at: string;
};

export type SpaceAnnouncement = {
  id: string;
  space_id: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type Restaurant = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  halal_type: string;
  verification_category: string;
  notes: string | null;
  cover_image_url?: string | null;
  // Rating fields (computed from reviews)
  average_rating: number;
  review_count: number;
  cuisine?: string | null;
};

export type RestaurantReview = {
  id: string;
  restaurant_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
};

export type VerificationLevel = {
  id: string;
  name: string;
  description: string | null;
};

export type BazaarPost = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  photo_url: string | null;
  city: string | null;
  contact: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  status: 'active' | 'sold';
  sold_at: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_super_admin: boolean;
  seller_rating: number;
  seller_rating_count: number;
  created_at: string;
  updated_at: string;
};

/**
 * Helper to get a display name from a profile.
 * Falls back to email username or 'Anonymous' if no name is set.
 */
export function getDisplayName(profile: Profile | null, email?: string): string {
  if (profile?.first_name || profile?.last_name) {
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  }
  if (email) {
    return email.split('@')[0];
  }
  return 'Anonymous';
}

/**
 * Helper to get user initials from a profile.
 */
export function getInitials(profile: Profile | null, email?: string): string {
  if (profile?.first_name || profile?.last_name) {
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return '?';
}

// Bazaar Messaging Types

export type BazaarConversation = {
  id: string;
  post_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  created_at: string;
  // Joined fields (populated via select)
  post?: BazaarPost;
  buyer_profile?: Profile;
  seller_profile?: Profile;
  last_message?: BazaarMessage;
  unread_count?: number;
};

export type BazaarMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

export type SellerRating = {
  id: string;
  seller_id: string;
  buyer_id: string;
  post_id: string | null;
  rating: number;
  review_text: string | null;
  created_at: string;
  // Joined fields
  buyer_profile?: Profile;
};
