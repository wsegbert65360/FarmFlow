import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
        try {
            await AsyncStorage.setItem('farmflow_active_farm', farmId);
            // In a real app with 'FarmGate', this would trigger a context update.
            // For now, we force a reload to ensure all hooks (useDatabase) pick up the change
            // if they are reading from storage or if we emitted an event.
            // Since this is a lightweight web/mobile app, a reload is the safest "Hard Switch".
            if (Platform.OS === 'web') {
                window.location.reload();
            } else {
                // For native, we might need a bespoke 'FarmContext' that wraps the app.
                // Assuming 'useDatabase' reads this somehow or we assume one farm for now.
                // We'll just alert.
                alert('Farm switched. Please restart app to apply.');
            }
        } catch (e) {
            console.error('Failed to switch farm', e);
        }
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

export const useAuth = () => useContext(AuthContext);

