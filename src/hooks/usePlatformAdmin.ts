import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminCheck {
  isPlatformAdmin: boolean;
  isEmailVerified: boolean;
  isMfaEnrolled: boolean;
  isLoading: boolean;
  canAccessAdmin: boolean;
}

export const usePlatformAdmin = () => {
  const [adminCheck, setAdminCheck] = useState<AdminCheck>({
    isPlatformAdmin: false,
    isEmailVerified: false,
    isMfaEnrolled: false,
    isLoading: true,
    canAccessAdmin: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      setAdminCheck(prev => ({ ...prev, isLoading: true }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAdminCheck({
          isPlatformAdmin: false,
          isEmailVerified: false,
          isMfaEnrolled: false,
          isLoading: false,
          canAccessAdmin: false,
        });
        return;
      }

      // Check if user is platform admin using the security definer function
      const { data: platformAdminResult, error: adminError } = await supabase
        .rpc('is_platform_admin', { user_uuid: user.id });

      if (adminError) {
        console.error('Error checking platform admin status:', adminError);
        setAdminCheck(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const isPlatformAdmin = !!platformAdminResult;
      const isEmailVerified = !!user.email_confirmed_at;

      // Check MFA enrollment
      const { data: mfaFactors, error: mfaError } = await supabase.auth.mfa.listFactors();
      const isMfaEnrolled = !mfaError && mfaFactors?.all?.length > 0;

      const canAccessAdmin = isPlatformAdmin && isEmailVerified && isMfaEnrolled;

      setAdminCheck({
        isPlatformAdmin,
        isEmailVerified,
        isMfaEnrolled,
        isLoading: false,
        canAccessAdmin,
      });

    } catch (error) {
      console.error('Error checking admin status:', error);
      setAdminCheck(prev => ({ ...prev, isLoading: false }));
    }
  };

  return { ...adminCheck, refreshAdminStatus: checkAdminStatus };
};