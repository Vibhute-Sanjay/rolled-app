import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { FeedHeader } from '../../components/FeedHeader';
import PagerView from 'react-native-pager-view';
import { FeedList } from '../../components/FeedList';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    withTiming,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { useFeedScroll } from '../../context/FeedScrollContext';
import { UploadProgressBanner } from '../../components/UploadProgressBanner';

const HEADER_HEIGHT_BASE = 90;

function FeedContent() {
    const { isScrollEnabled, tabBarTranslateY } = useFeedScroll();
    const insets = useSafeAreaInsets();
    const HEADER_HEIGHT = HEADER_HEIGHT_BASE;
    const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 60;

    const [activeTab, setActiveTab] = useState<'campus' | 'following'>('campus');
    const pagerRef = useRef<any>(null);

    const translationY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event, ctx: any) => {
            'worklet';
            const currentY = event.contentOffset.y;
            const prevY = ctx.prevY ?? currentY;
            const diff = currentY - prevY;

            if (currentY < 5) {
                translationY.value = withTiming(0, { duration: 100 });
                tabBarTranslateY.value = withTiming(0, { duration: 100 });
            } else {
                // Header hides (translates up)
                let newVal = translationY.value + diff;
                if (newVal < 0) newVal = 0;
                if (newVal > HEADER_HEIGHT) newVal = HEADER_HEIGHT;
                translationY.value = newVal;

                // Tab bar hides (translates down)
                let tabVal = tabBarTranslateY.value + diff;
                if (tabVal < 0) tabVal = 0;
                if (tabVal > TAB_BAR_HEIGHT) tabVal = TAB_BAR_HEIGHT;
                tabBarTranslateY.value = tabVal;
            }
            ctx.prevY = currentY;
        },
        onBeginDrag: (event, ctx: any) => {
            'worklet';
            ctx.prevY = event.contentOffset.y;
        }
    });

    useEffect(() => {
        translationY.value = withTiming(0, { duration: 250 });
        tabBarTranslateY.value = withTiming(0, { duration: 250 });
    }, [activeTab]);

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: interpolate(
                        translationY.value,
                        [0, HEADER_HEIGHT],
                        [0, -HEADER_HEIGHT],
                        Extrapolation.CLAMP
                    )
                }
            ],
        };
    });

    const handleTabChange = (tab: 'campus' | 'following') => {
        setActiveTab(tab);
        if (tab === 'campus') {
            pagerRef.current?.setPage(0);
        } else {
            pagerRef.current?.setPage(1);
        }
    };

    const onPageSelected = (e: any) => {
        const page = e.nativeEvent.position;
        setActiveTab(page === 0 ? 'campus' : 'following');
    };

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }} >
            <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: insets.top,
                backgroundColor: Colors.dark.background,
                zIndex: 2000,
            }} />

            <Animated.View style={[
                styles.headerContainer,
                styles.headerBase,
                { top: insets.top, height: HEADER_HEIGHT },
                headerAnimatedStyle
            ]}>
                <FeedHeader activeTab={activeTab} onTabChange={handleTabChange} />
            </Animated.View>

            <UploadProgressBanner />

            <PagerView
                ref={pagerRef}
                style={styles.pagerView}
                initialPage={0}
                onPageSelected={onPageSelected}
                scrollEnabled={isScrollEnabled}
            >
                <View key="1">
                    <FeedList
                        audience="campus"
                        isActiveTab={activeTab === 'campus'}
                        // @ts-ignore
                        onScroll={scrollHandler}
                        headerHeight={HEADER_HEIGHT}
                    />
                </View>
                <View key="2">
                    <FeedList
                        audience="following"
                        isActiveTab={activeTab === 'following'}
                        // @ts-ignore
                        onScroll={scrollHandler}
                        headerHeight={HEADER_HEIGHT}
                    />
                </View>
            </PagerView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    headerBase: {
        backgroundColor: Colors.dark.background,
    },
    pagerView: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
});

export default function Feed() {
    return <FeedContent />;
}
