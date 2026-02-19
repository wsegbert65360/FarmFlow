import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    switchFarm: (farmId: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signOut: async () => { },
    switchFarm: async () => { }
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const switchFarm = async (farmId: string) => {
        // In a real implementation, we might update a 'last_farm_id' in user profile
        // For now, we rely on the App wrapper to pick up the new farm if we force a reload or state change.
        // A simple way is to reload the app if on web, or just trigger a re-render.
        // However, the cleanest way in this architecture is to update the 'settings' table or local state?
        // Actually, 'settings' is per-farm. 
        // Strategy: We will use the 'FarmGate' concept. If we change the 'farmId' prop passed to data hooks, it should work.
        // But 'FarmGate' usually reads from the first available farm or a stored preference.
        // Let's store 'activeFarmId' in AsyncStorage/localStorage.

        // For Phase 4, let's assume we just need to notify the app.
        // We'll expose a listener or just rely on the UI to drive the change if we pass it down.
        // But simpler: just reload the window on web, or emit an event.
        console.log('Switching to farm:', farmId);
        // TODO: wiring this up fully requires a 'UserPreferences' table or local storage check in FarmGate.
        // For now, prompt the user that switching reloads the context.
    };

    const value = {
        session,
        user: session?.user ?? null,
        loading,
        signOut,
        switchFarm
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

