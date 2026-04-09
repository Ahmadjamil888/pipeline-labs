import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard'); // redirect after login
      } else {
        navigate('/auth');
      }
    });
  }, [navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-[#131313]">
      <div className="flex flex-col items-center gap-8 text-center animate-in fade-in zoom-in duration-700">
        <div className="relative">
          <div className="w-20 h-20 border-2 border-white/5 border-t-white rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-3xl animate-pulse">lock_open</span>
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-light tracking-tighter text-white">
            Finalizing Authentication
          </h2>
          <p className="text-neutral-500 font-light max-w-sm mx-auto">
            Synchronizing your secure data pipeline environment. Please wait a moment while we redirect you to your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
