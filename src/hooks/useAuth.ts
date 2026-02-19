import { useContext } from 'react';
import { AuthContext } from '../context/AuthProvider'; // Assuming I export AuthContext from there or I move it.

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
