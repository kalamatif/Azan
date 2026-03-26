export type UserRole = 'user' | 'muazzin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  mosqueId?: string;
  homeMosqueId?: string;
  backgroundEnabled?: boolean;
}

export interface Mosque {
  id: string;
  name: string;
  location: string;
  adminUid: string;
  isLive: boolean;
  currentStreamId?: string;
}

export interface StreamSession {
  id: string;
  mosqueId: string;
  startTime: string;
  status: 'live' | 'ended';
}
