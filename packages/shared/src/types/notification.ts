import type { Database } from '../database.types';

export type NotificationType = Database['public']['Enums']['notification_type'];
export type AppNotification = Database['public']['Tables']['notifications']['Row'];

export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageKind = Message['kind'];

export type ConversationWithRelations = Conversation & {
  residence: {
    id: string;
    title: string;
    photos: string[];
    price_monthly: number;
    city: string;
    zone: string | null;
  } | null;
  peer: {
    id: string;
    full_name: string;
    role: string;
    avatar_url: string | null;
  } | null;
  unread_count: number;
};
