
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const ScreenWrapper = ({ children, style }: ScreenWrapperProps) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, style]}>
            <StatusBar style="light" />
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        paddingHorizontal: 15,
    },
});
