import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { StatusBar } from 'expo-status-bar';

type Theme = 'dark' | 'midnight';

interface ThemeContextType {
    theme: Theme;
    colors: typeof Colors.dark | typeof Colors.midnight;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    colors: Colors.dark,
    toggleTheme: () => { },
    setTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setThemeState] = useState<Theme>('dark');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const storedTheme = await AsyncStorage.getItem('app_theme');
            if (storedTheme === 'midnight' || storedTheme === 'dark') {
                setThemeState(storedTheme);
            }
        } catch (error) {
            console.error('Failed to load theme', error);
        }
    };

    const toggleTheme = async () => {
        const newTheme = theme === 'dark' ? 'midnight' : 'dark';
        setThemeState(newTheme);
        try {
            await AsyncStorage.setItem('app_theme', newTheme);
        } catch (error) {
            console.error('Failed to save theme', error);
        }
    };

    const setTheme = async (newTheme: Theme) => {
        setThemeState(newTheme);
        try {
            await AsyncStorage.setItem('app_theme', newTheme);
        } catch (error) {
            console.error('Failed to save theme', error);
        }
    };

    const value = {
        theme,
        colors: theme === 'midnight' ? Colors.midnight : Colors.dark,
        toggleTheme,
        setTheme,
    };

    return (
        <ThemeContext.Provider value={value}>
            <StatusBar style="light" />
            {children}
        </ThemeContext.Provider>
    );
};
