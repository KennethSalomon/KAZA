import { Metadata } from 'next';
import { ConversationList } from '@/components/chat/conversation-list';

export const metadata: Metadata = { title: 'Messages' };

export default function ChatIndexPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">Messagerie</h1>
      <p className="mt-1 text-sm text-kaza-muted">Discutez, négociez, validez vos visites.</p>
      <div className="mt-6 max-w-2xl">
        <ConversationList />
      </div>
    </div>
  );
}