/**
 * apps/mobile/src/app/(tabs)/index.tsx
 * PVOT Mobile — Timeline Screen (Primary Tab)
 *
 * The mobile equivalent of the web UnifiedTimeline.
 * Shows a FlatList of MeetingCards for the current day.
 * Tapping a card navigates to /event/[id] (bottom sheet detail).
 */

import {
  View, FlatList, Text, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useRouter }           from 'expo-router';
import { SafeAreaView }        from 'react-native-safe-area-context';
import { useCalendarQuery }    from '@pvot/query/useCalendarQuery';
import { useUIStore }          from '@pvot/core/stores';
import { color, font, space, radius } from '@pvot/core/tokens';
import { formatDateHeading, formatTimeRange, formatDuration } from '@pvot/ui/lib/utils';
import type { Meeting }        from '@pvot/core/types';

const ACCOUNT_COLORS = color.account;

export default function TimelineScreen() {
  const router    = useRouter();
  const { meetings, isLoading, isFetching, refetch, timezone } = useCalendarQuery();
  const viewDate  = useUIStore((s) => s.viewDate);
  const privacyMode = useUIStore((s) => s.privacyMode);

  const handlePress = (meeting: Meeting) => {
    useUIStore.getState().selectEvent(meeting.id);
    router.push(`/event/${encodeURIComponent(meeting.id)}`);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>
          PV<Text style={styles.wordmarkAccent}>O</Text>T
        </Text>
        <Text style={styles.dateLabel}>
          {formatDateHeading(new Date().toISOString(), timezone)}
        </Text>
      </View>

      {/* Meeting list */}
      <FlatList
        data={isLoading ? Array(5).fill(null) : meetings}
        keyExtractor={(item, i) => item?.id ?? `skeleton-${i}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={color.blue500}
          />
        }
        renderItem={({ item: meeting, index }) => {
          if (!meeting) {
            return <MeetingCardSkeleton />;
          }
          return (
            <MobileMeetingCard
              meeting={meeting}
              timezone={timezone}
              privacyMode={privacyMode}
              onPress={() => handlePress(meeting)}
              animationDelay={index * 40}
            />
          );
        }}
        ListEmptyComponent={!isLoading ? <EmptyState /> : null}
      />
    </SafeAreaView>
  );
}

// ─── MOBILE MEETING CARD ──────────────────────────────────────────────────────

function MobileMeetingCard({
  meeting, timezone, privacyMode, onPress,
}: {
  meeting: Meeting;
  timezone: string;
  privacyMode: boolean;
  onPress: () => void;
  animationDelay?: number;
}) {
  const accentColor = ACCOUNT_COLORS[meeting.colorIndex];
  const timeRange   = formatTimeRange(meeting.startUtc, meeting.endUtc, timezone);
  const duration    = formatDuration(meeting.startUtc, meeting.endUtc);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${meeting.title}, ${timeRange}, ${duration}`}
      style={[
        styles.card,
        meeting.isConflict && styles.cardConflict,
      ]}
    >
      {/* Account color bar */}
      <View style={[styles.colorBar, { backgroundColor: accentColor }]} />

      <View style={styles.cardTime}>
        <Text style={styles.timeText}>{timeRange.split('–')[0].trim()}</Text>
        <Text style={styles.durationText}>{duration}</Text>
      </View>

      <View style={styles.cardContent}>
        <Text
          style={[styles.cardTitle, privacyMode && styles.blurred]}
          numberOfLines={2}
        >
          {meeting.title}
        </Text>
        {meeting.isConflict && (
          <View style={styles.conflictBadge}>
            <Text style={styles.conflictBadgeText}>Conflict</Text>
          </View>
        )}
        {meeting.videoLink && (
          <Text style={[styles.joinHint, { color: accentColor }]}>
            {meeting.videoLink.label} →
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function MeetingCardSkeleton() {
  return (
    <View style={[styles.card, styles.skeletonCard]}>
      <View style={[styles.colorBar, { backgroundColor: color.rim }]} />
      <View style={styles.cardTime}>
        <View style={[styles.skeletonLine, { width: 50 }]} />
        <View style={[styles.skeletonLine, { width: 36, marginTop: 6 }]} />
      </View>
      <View style={styles.cardContent}>
        <View style={[styles.skeletonLine, { width: '70%', height: 14 }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No events today</Text>
      <Text style={styles.emptyBody}>
        Your calendar is clear. Events from all connected workspaces appear here.
      </Text>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },

  header: {
    paddingHorizontal: space[6],
    paddingTop:        space[4],
    paddingBottom:     space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
    backgroundColor:   color.base,
  },
  wordmark: {
    fontFamily:    'DMSans-Bold',
    fontSize:      22,
    color:         color.primary,
    letterSpacing: -0.6,
  },
  wordmarkAccent: { color: color.blue500 },
  dateLabel: {
    fontFamily: 'IBMPlexSans',
    fontSize:   font.size.bodySm,
    color:      color.secondary,
    marginTop:  space[1],
  },

  list: { padding: space[4], gap: space[2] },

  card: {
    flexDirection:   'row',
    backgroundColor: color.raised,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     color.rim,
    overflow:        'hidden',
    marginBottom:    space[2],
  },
  cardConflict: {
    borderColor:     `${color.warning}40`,
    backgroundColor: `${color.warning}08`,
  },
  skeletonCard: { opacity: 0.6 },

  colorBar: { width: 3 },

  cardTime: {
    paddingHorizontal: space[3],
    paddingVertical:   space[3],
    width:             84,
  },
  timeText: {
    fontFamily: 'IBMPlexMono',
    fontSize:   font.size.labelSm,
    color:      color.secondary,
  },
  durationText: {
    fontFamily: 'IBMPlexMono',
    fontSize:   font.size.labelXs,
    color:      color.muted,
    marginTop:  space[1],
  },

  cardContent: {
    flex:            1,
    paddingRight:    space[3],
    paddingVertical: space[3],
    justifyContent:  'center',
  },
  cardTitle: {
    fontFamily: 'IBMPlexSans-Medium',
    fontSize:   font.size.bodyMd,
    color:      color.primary,
    lineHeight: 20,
  },
  blurred: { opacity: 0.15 },

  conflictBadge: {
    alignSelf:       'flex-start',
    backgroundColor: `${color.warning}15`,
    borderWidth:     1,
    borderColor:     `${color.warning}30`,
    borderRadius:    radius.sm,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    marginTop:       space[1],
  },
  conflictBadgeText: {
    fontFamily: 'IBMPlexSans-Medium',
    fontSize:   font.size.labelXs,
    color:      color.warning,
  },

  joinHint: {
    fontFamily: 'IBMPlexSans-Medium',
    fontSize:   font.size.labelSm,
    marginTop:  space[1],
  },

  skeletonLine: {
    height:        10,
    backgroundColor: color.rim,
    borderRadius:  radius.sm,
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: space[20],
    paddingHorizontal: space[8],
  },
  emptyTitle: {
    fontFamily:  'DMSans-SemiBold',
    fontSize:    font.size.headingSm,
    color:       color.secondary,
    marginBottom: space[2],
  },
  emptyBody: {
    fontFamily: 'IBMPlexSans',
    fontSize:   font.size.bodySm,
    color:      color.muted,
    textAlign:  'center',
    lineHeight: 20,
  },
});
