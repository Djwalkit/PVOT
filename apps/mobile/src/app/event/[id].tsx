/**
 * apps/mobile/src/app/event/[id].tsx
 * PVOT Mobile — Event Detail Screen
 *
 * Rendered as a modal/bottom-sheet when a meeting card is tapped.
 * Displays all meeting detail: time, attendees, video link, description.
 */

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Video, MapPin, Clock, Users, ExternalLink } from 'lucide-react-native';
import { useCalendarQuery } from '@pvot/query/useCalendarQuery';
import { useUIStore }       from '@pvot/core/stores';
import { color, font, space, radius } from '@pvot/core/tokens';
import { formatTimeRange, formatDuration, formatTimezoneLabel } from '@pvot/ui/lib/utils';

export default function EventDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const { meetings, timezone } = useCalendarQuery();
  const privacyMode = useUIStore((s) => s.privacyMode);

  const meeting = meetings.find((m) => m.id === decodeURIComponent(id ?? ''));

  if (!meeting) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Event not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const accentColor = color.account[meeting.colorIndex];
  const timeRange   = formatTimeRange(meeting.startUtc, meeting.endUtc, timezone);
  const duration    = formatDuration(meeting.startUtc, meeting.endUtc);

  const handleJoin = () => {
    if (meeting.videoLink?.url) {
      Linking.openURL(meeting.videoLink.url);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderTopColor: accentColor }]}>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.title, privacyMode && styles.blurred]}
            numberOfLines={3}
          >
            {meeting.title}
          </Text>
          <Text style={styles.time}>{timeRange} · {duration}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityLabel="Close event detail"
        >
          <X size={20} color={color.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Status badges */}
        <View style={styles.badges}>
          {meeting.isConflict && (
            <View style={[styles.badge, styles.badgeAmber]}>
              <Text style={[styles.badgeText, { color: color.warning }]}>Conflict</Text>
            </View>
          )}
          {meeting.selfRsvp === 'accepted' && (
            <View style={[styles.badge, styles.badgeEmerald]}>
              <Text style={[styles.badgeText, { color: color.emerald500 }]}>Accepted</Text>
            </View>
          )}
        </View>

        {/* Join button */}
        {meeting.videoLink && (
          <TouchableOpacity
            onPress={handleJoin}
            style={[styles.joinBtn, { backgroundColor: accentColor }]}
            accessibilityLabel={meeting.videoLink.label}
            accessibilityRole="link"
          >
            <Video size={18} color="#fff" />
            <Text style={styles.joinBtnText}>{meeting.videoLink.label}</Text>
          </TouchableOpacity>
        )}

        {/* Detail rows */}
        <View style={styles.details}>
          <DetailRow icon={<Clock size={16} color={color.muted} />} label="Time">
            <Text style={styles.detailValue}>{timeRange}</Text>
            <Text style={styles.detailMeta}>{formatTimezoneLabel(timezone)}</Text>
          </DetailRow>

          {meeting.location && (
            <DetailRow icon={<MapPin size={16} color={color.muted} />} label="Location">
              <Text style={[styles.detailValue, privacyMode && styles.blurred]}>
                {meeting.location}
              </Text>
            </DetailRow>
          )}

          {meeting.attendees.length > 0 && (
            <DetailRow
              icon={<Users size={16} color={color.muted} />}
              label={`${meeting.attendees.length} attendees`}
            >
              {meeting.attendees.slice(0, 6).map((a) => (
                <Text
                  key={a.email}
                  style={[styles.attendeeRow, privacyMode && styles.blurred]}
                >
                  {a.displayName ?? a.email}
                  <Text style={styles.rsvpLabel}> · {a.responseStatus}</Text>
                </Text>
              ))}
              {meeting.attendees.length > 6 && (
                <Text style={styles.moreAttendees}>
                  +{meeting.attendees.length - 6} more
                </Text>
              )}
            </DetailRow>
          )}
        </View>

        {/* Open in Google Calendar */}
        <TouchableOpacity
          onPress={() => Linking.openURL(meeting.htmlLink)}
          style={styles.externalLink}
          accessibilityLabel="Open in Google Calendar"
          accessibilityRole="link"
        >
          <ExternalLink size={14} color={color.muted} />
          <Text style={styles.externalLinkText}>Open in Google Calendar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: color.base },
  header: {
    borderTopWidth: 3, padding: space[5],
    flexDirection: 'row', alignItems: 'flex-start', gap: space[3],
    borderBottomWidth: 1, borderBottomColor: color.divider,
  },
  title: { fontFamily: 'DMSans-SemiBold', fontSize: font.size.headingSm, color: color.primary, lineHeight: 26 },
  time:  { fontFamily: 'IBMPlexMono', fontSize: font.size.labelSm, color: color.secondary, marginTop: space[1] },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.raised, borderWidth: 1, borderColor: color.rim,
  },
  body: { padding: space[5] },
  badges: { flexDirection: 'row', gap: space[2], marginBottom: space[4] },
  badge: { paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  badgeAmber:  { backgroundColor: `${color.warning}10`,  borderColor: `${color.warning}30` },
  badgeEmerald:{ backgroundColor: `${color.emerald500}10`, borderColor: `${color.emerald500}30` },
  badgeText: { fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.labelXs },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
    padding: space[4], borderRadius: radius.md, marginBottom: space[5],
  },
  joinBtnText: { fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.uiLg, color: '#fff' },
  details: { gap: space[4] },
  detailRow: { flexDirection: 'row', gap: space[3] },
  detailIcon: { paddingTop: 2, width: 20 },
  detailLabel: { fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.labelSm, color: color.muted, marginBottom: 2 },
  detailValue: { fontFamily: 'IBMPlexSans', fontSize: font.size.bodyMd, color: color.primary },
  detailMeta:  { fontFamily: 'IBMPlexMono', fontSize: font.size.labelXs, color: color.muted, marginTop: 2 },
  attendeeRow: { fontFamily: 'IBMPlexSans', fontSize: font.size.bodySm, color: color.secondary, marginBottom: 2 },
  rsvpLabel:   { color: color.muted },
  moreAttendees:{ fontFamily: 'IBMPlexSans', fontSize: font.size.labelSm, color: color.muted },
  externalLink: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    marginTop: space[8], justifyContent: 'center',
  },
  externalLinkText: { fontFamily: 'IBMPlexSans', fontSize: font.size.bodySm, color: color.muted },
  blurred: { opacity: 0.1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontFamily: 'IBMPlexSans', fontSize: font.size.bodyMd, color: color.secondary },
  backBtn: { marginTop: space[4] },
  backBtnText: { fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.bodyMd, color: color.blue500 },
});
