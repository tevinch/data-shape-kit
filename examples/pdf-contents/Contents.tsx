import {
  Link,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ContentsEntry } from './pdf-contents.js';

export interface ContentsProps {
  readonly entries: readonly ContentsEntry[];
  readonly title?: string;
}

const styles = StyleSheet.create({
  contents: {
    width: '100%',
  },
  title: {
    color: '#183b45',
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    marginBottom: 14,
  },
  row: {
    alignItems: 'flex-start',
    borderBottomColor: '#d8e3e4',
    borderBottomWidth: 0.6,
    flexDirection: 'row',
    paddingBottom: 6,
    paddingTop: 6,
    width: '100%',
  },
  label: {
    color: '#24383d',
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.35,
    paddingRight: 12,
    textDecoration: 'none',
  },
  pageNumber: {
    color: '#0f7076',
    flexGrow: 0,
    flexShrink: 0,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    lineHeight: 1.35,
    textAlign: 'right',
    width: 34,
  },
});

export function Contents({
  entries,
  title = 'Contents',
}: ContentsProps) {
  return (
    <View style={styles.contents}>
      <Text minPresenceAhead={34} style={styles.title}>{title}</Text>
      {entries.map((entry) => (
        <View
          key={entry.id}
          style={[styles.row, { paddingLeft: (entry.level - 1) * 14 }]}
          wrap={false}
        >
          <Link src={`#${entry.id}`} style={styles.label}>
            {entry.title}
          </Link>
          <Text style={styles.pageNumber}>
            {entry.pageNumber === null ? '...' : String(entry.pageNumber)}
          </Text>
        </View>
      ))}
    </View>
  );
}
