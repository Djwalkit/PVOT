/**
 * apps/mobile/src/app/(tabs)/settings.tsx
 * PVOT Mobile — Settings Tab
 */

import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useUIStore }     from '@pvot/core/stores';
import { color, font, space, radius } from '@pvot/core/tokens';

export default function SettingsScreen() {
  const privacyMode   = useUIStore((s) => s.privacyMode);
  const togglePrivacy = useUIStore((s) => s.togglePrivacy);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Display</Text>

        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Privacy mode</Text>
            <Text style={styles.rowDesc}>Blur meeting titles for screen sharing.</Text>
          </View>
          <Switch
            value={privacyMode}
            onValueChange={togglePrivacy}
            trackColor={{ false: color.rim, true: color.blue500 }}
            thumbColor={color.primary}
            accessibilityLabel="Toggle privacy mode"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Calendar scope</Text>
          <Text style={[styles.rowValue, styles.mono]}>calendar.readonly</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  header: {
    paddingHorizontal: space[6], paddingTop: space[5], paddingBottom: space[4],
    borderBottomWidth: 1, borderBottomColor: color.divider, backgroundColor: color.base,
  },
  title: { fontFamily: 'DMSans-Bold', fontSize: font.size.headingSm, color: color.primary },
  section: { paddingHorizontal: space[4], paddingTop: space[5] },
  sectionLabel: {
    fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.labelXs, color: color.muted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2],
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: color.raised, borderRadius: radius.md, borderWidth: 1,
    borderColor: color.rim, padding: space[4], marginBottom: space[2],
  },
  rowInfo: { flex: 1, marginRight: space[3] },
  rowTitle: { fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.bodyMd, color: color.primary },
  rowDesc: { fontFamily: 'IBMPlexSans', fontSize: font.size.bodySm, color: color.muted, marginTop: 2 },
  rowValue: { fontFamily: 'IBMPlexSans', fontSize: font.size.bodySm, color: color.secondary },
  mono: { fontFamily: 'IBMPlexMono', fontSize: font.size.labelSm },
});
