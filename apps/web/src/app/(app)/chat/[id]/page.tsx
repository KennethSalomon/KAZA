import { Metadata } from 'next';
import { ChatWindow } from '@/components/chat/chat-window';

export const metadata: Metadata = { title: 'Conversation' };

export default function ChatConversationPage() {
  return <ChatWindow />;
}