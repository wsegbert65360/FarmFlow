import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { db } from '../db/powersync';
import { Platform } from 'react-native';

export const useSync = () => {
    const { session } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Centralized handleSync function
    const handleSync = async () => {
        if (!session?.user) return;
        const { SyncUtility } = require('../utils/SyncUtility');
        if (SyncUtility.isNativeStreamingAvailable()) return;

        setIsSyncing(true);
        try {
            const { SyncUtility } = require('../utils/SyncUtility');
            const { showAlert } = require('../utils/AlertUtility');
            const result = await SyncUtility.performFullSync(session.user.id);

            if (result.success) {
                setIsConnected(true);
            } else {
                if (!result.message.includes('complete onboarding')) {
                    showAlert('Sync Warning', result.message);
                }
            }
        } catch (e: any) {
            console.error('[Sync Error]', e);
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-sync
    useEffect(() => {
        if (session?.user) {
            const { SyncUtility } = require('../utils/SyncUtility');
            if (!SyncUtility.isNativeStreamingAvailable()) {
                const timer = setTimeout(handleSync, 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [session?.user?.id]);

    // Listener
    useEffect(() => {
        const isWeb = Platform.OS === 'web';
        if (!isWeb) setIsConnected(!!(db as any).status?.connected);

        const unsubscribe = db.registerListener({
            statusChanged: (status) => {
                setIsConnected(!isWeb && !!status.connected);
            }
        });

        return () => unsubscribe();
    }, []);

    return { isConnected, isSyncing, handleSync };
};
