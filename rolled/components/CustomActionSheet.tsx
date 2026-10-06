
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback, Dimensions } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export interface ActionSheetOption {
    label: string;
    icon?: string;
    isDestructive?: boolean;
    onPress: () => void;
}

interface ActionSheetProps {
    visible: boolean;
    onClose: () => void;
    options: ActionSheetOption[];
    title?: string;
}

export const CustomActionSheet = ({ visible, onClose, options, title }: ActionSheetProps) => {

    // Prevent back button close issues on Android
    useEffect(() => {
        // any logic needed for back handling
    }, []);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <Animated.View
                            entering={SlideInDown.springify().damping(18)}
                            exiting={SlideOutDown}
                            style={styles.sheetContainer}
                        >
                            {/* Decorative Handle */}
                            <View style={styles.handleIndicator} />

                            {title && <Text style={styles.title}>{title}</Text>}

                            <View style={styles.optionsContainer}>
                                {options.map((option, index) => (
                                    <View key={index}>
                                        <TouchableOpacity
                                            style={styles.optionItem}
                                            onPress={() => {
                                                onClose();
                                                setTimeout(option.onPress, 350); // Delay safely allows the SlideOutDown animation to unmount
                                            }}
                                        >
                                            {option.icon && (
                                                <MaterialCommunityIcons
                                                    // @ts-ignore
                                                    name={option.icon}
                                                    size={22}
                                                    color={option.isDestructive ? Colors.dark.error : Colors.dark.text}
                                                />
                                            )}
                                            <Text style={[
                                                styles.optionLabel,
                                                option.isDestructive && { color: Colors.dark.error }
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                        {index < options.length - 1 && <View style={styles.divider} />}
                                    </View>
                                ))}
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 40,
        paddingHorizontal: 20,
        paddingTop: 10,
        minHeight: 200,
        borderWidth: 1,
        borderColor: '#333',
        borderBottomWidth: 0,
    },
    handleIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
        marginTop: 5,
    },
    title: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
    },
    optionsContainer: {
        gap: 0,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        gap: 15,
        justifyContent: 'flex-start', // Align left as per typical menus, user said "top to bottom"
    },
    optionLabel: {
        color: Colors.dark.text,
        fontSize: 18,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#333',
        width: '100%',
    }
});
