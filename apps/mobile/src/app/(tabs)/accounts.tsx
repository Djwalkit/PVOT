/**
 * apps/mobile/src/app/(tabs)/accounts.tsx
 * PVOT Mobile — Accounts Tab
 *
 * Manage connected Google accounts: add, reconnect, remove.
 */

import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView }     from 'react-native-safe-area-context';
import { Plus, AlertCircle, CheckCircle } from 'lucide-react-native';
import { useAuthStore }     from '@pvot/core/stores';
import { getOAuthClient }   from '@pvot/core/auth/OAuthClient';
import { color, font, space, radius } from '@pvot/core/tokens';
import type { ConnectedAccount } from '@pvot/core/types';

export default function AccountsScreen() {
  const accounts      = useAuthStore((s) => s.accounts);
  const removeAccount = useAuthStore((s) => s.removeAccount);

  const handleAdd = async () => {
    try {
      await getOAuthClient().beginAuth(null);
    } catch {
      Alert.alert('Error', 'Could not initiate Google login. Please try again.');
    }
  };

  const handleReconnect = async (account: ConnectedAccount) => {
    try {
      await getOAuthClient().beginAuth(account.id);
    } catch {
      Alert.alert('Error', 'Could not reconnect. Please try again.');
    }
  };

  const handleRemove = (account: ConnectedAccount) => {
    Alert.alert(
      'Remove account',
      `Remove ${account.email} from PVOT? Your Google Calendar data is not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeAccount(account.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Workspaces</Text>
        <Text style={styles.subtitle}>Manage your connected Google accounts.</Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <AccountRow
            account={item}
            onReconnect={() => handleReconnect(item)}
            onRemove={() => handleRemove(item)}
          />
        )}
        ListFooterComponent={
          <TouchableOpacity
            onPress={handleAdd}
            style={styles.addButton}
            accessibilityLabel="Connect another Google account"
          >
            <Plus size={18} color={color.blue500} />
            <Text style={styles.addButtonText}>Connect Google account</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

function AccountRow({
  account, onReconnect, onRemove,
}: { account: ConnectedAccount; onReconnect: () => void; onRemove: () => void }) {
  const accentColor = color.account[account.colorIndex];
  const isError     = account.status === 'error';

  return (
    <View style={[styles.card, isError && styles.cardError]}>
      <View style={[styles.dot, { backgroundColor: accentColor }]} />
      <View style={styles.cardInfo}>
        <Text style={styles.name}>{account.displayName}</Text>
        <Text style={styles.email}>{account.email}</Text>
        {isError && account.errorMessage && (
          <Text style={styles.errorText}>{account.errorMessage}</Text>
        )}
      </View>
      {isError ? (
        <TouchableOpacity onPress={onReconnect} style={styles.reconnectBtn} accessibilityLabel="Reconnect">
          <AlertCircle size={16} color={color.danger} />
          <Text style={styles.reconnectText}>Reconnect</Text>
        </TouchableOpacity>
      ) : (
        <CheckCircle size={16} color={color.emerald500} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  header: {
    paddingHorizontal: space[6],
    paddingTop:  space[5],
    paddingBottom: space[4],
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
    backgroundColor: color.base,
  },
  title: { fontFamily: 'DMSans-Bold', fontSize: font.size.headingSm, color: color.primary },
  subtitle: { fontFamily: 'IBMPlexSans', fontSize: font.size.bodySm, color: color.secondary, marginTop: space[1] },
  list: { padding: space[4] },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    backgroundColor: color.raised, borderRadius: radius.md,
    borderWidth: 1, borderColor: color.rim, padding: space[4], marginBottom: space[2],
  },
  cardError: { borderColor: `${color.danger}30`, backgroundColor: `${color.danger}05` },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  cardInfo: { flex: 1 },
  name: { fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.bodyMd, color: color.primary },
  email: { fontFamily: 'IBMPlexSans', fontSize: font.size.bodySm, color: color.muted, marginTop: 2 },
  errorText: { fontFamily: 'IBMPlexSans', fontSize: font.size.labelSm, color: color.danger, marginTop: space[1] },
  reconnectBtn: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  reconnectText: { fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.labelSm, color: color.danger },
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
    padding: space[4], borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: color.rim, marginTop: space[2],
  },
  addButtonText: { fontFamily: 'IBMPlexSans-Medium', fontSize: font.size.bodyMd, color: color.blue500 },
});
