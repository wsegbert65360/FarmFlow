export const Theme = {
    colors: {
        primary: '#2E7D32', // Deep Farm Green
        secondary: '#F57C00', // Warning/Alert Orange
        background: '#FFFFFF',
        surface: '#F5F5F5',
        text: '#1A1A1A',
        textSecondary: '#757575',
        border: '#E0E0E0',
        danger: '#D32F2F',
        success: '#388E3C',
        warning: '#FBC02D',
        white: '#FFFFFF',
        whiteMuted: 'rgba(255,255,255,0.8)',
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
    },
    borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        round: 50,
    },
    typography: {
        h1: { fontSize: 24, fontWeight: 'bold' as const },
        h2: { fontSize: 20, fontWeight: 'bold' as const },
        body: { fontSize: 16 },
        caption: { fontSize: 12 },
    },
    shadows: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.18,
            shadowRadius: 1.0,
            elevation: 1,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 3,
        },
    }
};
