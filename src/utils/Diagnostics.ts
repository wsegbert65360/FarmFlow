import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { db } from '../db/powersync';
import { syncController } from '../sync/SyncController';
import { supabase } from '../supabase/client';

export const exportDiagnostics = async () => {
    try {
        const session = await supabase.auth.getSession();
        const syncState = syncController.getState();

        const diagnosticData = {
            timestamp: new Date().toISOString(),
            app: {
                name: 'FarmFlow',
                version: Constants.expoConfig?.version ?? '1.0.0',
                platform: process.platform,
            },
            auth: {
                userId: session.data.session?.user.id || null,
                authenticated: !!session.data.session,
            },
            sync: {
                status: syncState.mode,
                lastSyncedAt: syncState.lastSyncedAt?.toISOString(),
                isOnline: syncState.isConnected,
            },
            storage: {
                // Quick check of record counts
                fields: ((await db.getAll('SELECT count(*) as c FROM fields')) as any[])[0]['c'],
                logs: ((await db.getAll('SELECT count(*) as c FROM spray_logs')) as any[])[0]['c'],
            },
            errors: syncController.getErrorLog(),
        };

        const fileName = `${(FileSystem as any).documentDirectory}diagnostics_${new Date().getTime()}.json`;
        await FileSystem.writeAsStringAsync(fileName, JSON.stringify(diagnosticData, null, 2));

        if (await FileSystem.getInfoAsync(fileName)) {
            await Share.share({
                url: fileName,
                title: 'FarmFlow Diagnostics',
                message: 'Here is the FarmFlow diagnostics report.'
            });
        }
    } catch (error) {
        console.error('Failed to export diagnostics', error);
        alert('Failed to generate diagnostic report.');
    }
};
