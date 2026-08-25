'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { SplashScreen } from '@/components/onboarding/splash-screen';
import { ProfilePicker } from '@/components/onboarding/profile-picker';
import { ProfileConfirmation } from '@/components/onboarding/profile-confirmation';

export default function WelcomePage() {
  const { user, role: userRole } = useAuth();
  const router = useRouter();
  const [screen, setScreen] = useState<'splash' | 'profile' | 'confirm'>('splash');
  const [selectedRole, setSelectedRole] = useState<string>('locataire');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('kaza:selected-role');
      if (saved) setSelectedRole(saved);
    }
  }, []);

  const activeRole = userRole || selectedRole || 'locataire';

  const handleSplashFinished = () => {
    if (user) {
      setScreen('confirm');
    } else {
      setScreen('profile');
    }
  };

  const handleConfirmRole = (targetRole: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kaza:selected-role', targetRole);
    }
    const destination =
      targetRole === 'bailleur' ? '/landlord' : targetRole === 'admin' ? '/admin' : '/explorer';
    router.push(destination);
  };

  const handleChangeRole = () => {
    setScreen('profile');
  };

  if (screen === 'splash') {
    return <SplashScreen onFinished={handleSplashFinished} />;
  }

  if (screen === 'confirm' || (user && screen !== 'profile')) {
    return (
      <ProfileConfirmation
        user={user}
        role={activeRole}
        onConfirm={handleConfirmRole}
        onChangeRole={handleChangeRole}
      />
    );
  }

  return (
    <ProfilePicker
      initialSelected={selectedRole}
      onSelectRole={(role) => {
        setSelectedRole(role);
        if (user) {
          setScreen('confirm');
        }
      }}
    />
  );
}
