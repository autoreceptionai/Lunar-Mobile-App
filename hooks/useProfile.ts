import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

import { useSession } from './useSession';

type ProfileUpdate = {
  first_name?: string;
  last_name?: string;
};

export function useProfile() {
  const { user } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // Profile might not exist yet, try to create it
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user.id, first_name: '', last_name: '' })
          .select()
          .single();

        if (!insertError && newProfile) {
          setProfile(newProfile);
        }
      }
      setLoading(false);
      return;
    }

    setProfile(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(
    async (updates: ProfileUpdate): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not signed in' };
      }

      setUpdating(true);
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      setUpdating(false);

      if (error) {
        return { success: false, error: error.message };
      }

      setProfile(data);
      return { success: true };
    },
    [user]
  );

  const refetch = useCallback(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    updating,
    updateProfile,
    refetch,
  };
}
