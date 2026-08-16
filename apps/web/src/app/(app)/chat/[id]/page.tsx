'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatWindow } from '@/components/chat/chat-window';
import { ConversationList } from '@/components/chat/conversation-list';
import { useAuth } from '@/lib/auth-context';

export default function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [showList, setShowList] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mobile, default to showing the list if no conversation selected
  useEffect(() => {
    if (isMobile && !id) {
      setShowList(true);
    }
  }, [isMobile, id]);

  // If we have a conversation ID on mobile, show the chat window
  // If no ID, show the list
  // On desktop, always show both (handled by CSS)
  if (isMobile) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex flex-col">
        {showList || !id ? (
          <>
            <div className="flex h-16 items-center gap-3 border-b border-kaza-border px-4">
              <h1 className="font-display text-xl font-semibold tracking-tight text-kaza-text">Messagerie</h1>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationList />
            </div>
          </>
        ) : (
          <ChatWindow />
        )}
      </div>
    );
  }

  // Desktop: show both list and chat window side by side
  return (
    <div className="h-[calc(100dvh-4rem)] flex">
      <div className="w-80 min-w-80 max-w-80 border-r border-kaza-border flex flex-col hidden lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-kaza-border px-4">
          <h1 className="font-display text-xl font-semibold tracking-tight text-kaza-text">Messagerie</h1>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {id ? <ChatWindow /> : <ConversationList />}
      </div>
    </div>
  );
}