import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session during callback:', error.message);
      }
      // Redirect to dashboard regardless of whether session was active now
      // (Supabase will handle redirection or useAuth will pick up the change)
      navigate('/dashboard');
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] text-white">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-sm text-gray-400">Signing you in safely...</p>
      </div>
    </div>
  );
}
