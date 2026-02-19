import { useState, useEffect } from 'react';
import { syncController, SyncState } from './SyncController';

export const useSyncController = () => {
    const [state, setState] = useState<SyncState>(syncController.getState());

    useEffect(() => {
        return syncController.subscribe(setState);
    }, []);

    return {
        ...state,
        sync: () => syncController.sync(),
    };
};
