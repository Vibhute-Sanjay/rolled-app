import React, { createContext, useContext, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

interface FeedScrollContextType {
    isScrollEnabled: boolean;
    setScrollEnabled: (enabled: boolean) => void;
    tabBarTranslateY: SharedValue<number>;
}

const FeedScrollContext = createContext<FeedScrollContextType>({
    isScrollEnabled: true,
    setScrollEnabled: () => { },
    tabBarTranslateY: { value: 0 } as SharedValue<number>,
});

export const useFeedScroll = () => useContext(FeedScrollContext);

export const FeedScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isScrollEnabled, setScrollEnabled] = useState(true);
    const tabBarTranslateY = useSharedValue(0);

    return (
        <FeedScrollContext.Provider value={{ isScrollEnabled, setScrollEnabled, tabBarTranslateY }}>
            {children}
        </FeedScrollContext.Provider>
    );
};
