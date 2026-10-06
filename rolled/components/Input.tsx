
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';

interface InputProps extends TextInputProps {
    leftIcon?: string;
    rightIcon?: string;
    onRightIconPress?: () => void;
    error?: string | null;
    success?: boolean;
    description?: string;
    containerStyle?: ViewStyle;
    inputContainerStyle?: ViewStyle;
}

export const Input = ({ leftIcon, rightIcon, onRightIconPress, error, success, description, style, containerStyle, inputContainerStyle, ...props }: InputProps) => {
    // Border color logic
    let borderColor = Colors.dark.border;
    if (error) borderColor = Colors.dark.error;
    else if (success) borderColor = Colors.dark.success;
    else if (props.value && props.value.length > 0) borderColor = Colors.dark.primary;

    return (
        <View style={[styles.container, containerStyle]}>
            <View style={[styles.inputContainer, { borderColor }, inputContainerStyle]}>
                {leftIcon && (
                    <View style={styles.iconContainer}>
                        <FontAwesome5 name={leftIcon} size={18} color={Colors.dark.textSecondary} />
                    </View>
                )}

                <TextInput
                    style={[styles.input, style]}
                    placeholderTextColor={Colors.dark.textSecondary}
                    cursorColor={Colors.dark.primary}
                    {...props}
                />

                <View style={styles.rightIconContainer}>
                    {error ? (
                        <FontAwesome5 name="times-circle" size={18} color={Colors.dark.error} />
                    ) : success ? (
                        <FontAwesome5 name="check-circle" size={18} color={Colors.dark.success} />
                    ) : rightIcon ? (
                        <TouchableOpacity onPress={onRightIconPress}>
                            <FontAwesome5 name={rightIcon} size={18} color={Colors.dark.textSecondary} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {(error || description) && (
                <Text style={[styles.helperText, error ? { color: Colors.dark.error } : null]}>
                    {error || description}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.inputBackground,
        borderWidth: 1,
        borderRadius: 12,
        height: 56,
    },
    iconContainer: {
        paddingLeft: 16,
        paddingRight: 8,
    },
    rightIconContainer: {
        paddingRight: 16,
        paddingLeft: 8,
        zIndex: 10, // Ensure it's above input if overlaps happen
    },
    input: {
        flex: 1,
        color: Colors.dark.text,
        fontSize: 16,
        height: '100%',
        paddingVertical: 0, // Fix alignment on Android
        textAlignVertical: 'center',
        includeFontPadding: false,
    },
    helperText: {
        marginTop: 6,
        marginLeft: 4,
        fontSize: 12,
        color: Colors.dark.textSecondary,
    },
});
