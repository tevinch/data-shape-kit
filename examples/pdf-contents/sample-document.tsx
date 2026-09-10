import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  type DocumentProps,
} from '@react-pdf/renderer';
import { Fragment, type ReactElement } from 'react';
import { Contents } from './Contents.js';
import type { ContentsEntry, Heading } from './pdf-contents.js';

const chapterTitles = [
  'A Map Before the Journey',
  'Signals and Thresholds',
  'Working Notes',
  'A Deliberately Long Heading About Decisions That Must Remain Legible When They Wrap Across More Than One Line',
  'Patterns at the Edge',
  'Working Notes',
  'Small Changes, Wide Effects',
  'The Shape of a Useful Constraint',
  'Observations in Sequence',
  'Intervals and Cadence',
  'A Clearer View of Motion',
  'Closing the Loop',
] as const;

export const sampleHeadings: readonly Heading[] = Object.freeze(
  chapterTitles.flatMap((chapterTitle, chapterIndex) => {
    const chapterNumber = chapterIndex + 1;
    return [
      Object.freeze({
        id: `chapter-${chapterNumber}`,
        title: chapterTitle,
        level: 1,
      }),
      Object.freeze({
        id: `chapter-${chapterNumber}.observation`,
        title: 'Observation',
        level: 2,
      }),
      Object.freeze({
        id: `chapter-${chapterNumber}.method`,
        title: chapterIndex % 3 === 0
          ? 'Method and a longer description of the choices made along the way'
          : 'Method',
        level: 2,
      }),
      Object.freeze({
        id: `chapter-${chapterNumber}.detail`,
        title: 'Supporting detail',
        level: 3,
      }),
    ];
  }),
);

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f8faf8',
    color: '#223438',
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.52,
    paddingBottom: 58,
    paddingHorizontal: 58,
    paddingTop: 54,
  },
  cover: {
    backgroundColor: '#163d46',
    color: '#f4f6ef',
    justifyContent: 'center',
    padding: 68,
  },
  coverRule: {
    backgroundColor: '#59b8b1',
    height: 5,
    marginBottom: 28,
    width: 72,
  },
  eyebrow: {
    color: '#88d0c9',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 18,
    textTransform: 'uppercase',
  },
  coverTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 34,
    lineHeight: 1.12,
    marginBottom: 22,
    maxWidth: 410,
  },
  coverSummary: {
    color: '#d5e5df',
    fontSize: 13,
    lineHeight: 1.5,
    maxWidth: 390,
  },
  chapterNumber: {
    color: '#178089',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1.4,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  chapterTitle: {
    color: '#183b45',
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    lineHeight: 1.2,
    marginBottom: 12,
  },
  subheading: {
    color: '#0f7076',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    marginBottom: 7,
    marginTop: 7,
  },
  paragraph: {
    marginBottom: 10,
  },
  note: {
    backgroundColor: '#e8f1ef',
    borderLeftColor: '#45a5a2',
    borderLeftWidth: 3,
    color: '#345159',
    marginBottom: 25,
    marginTop: 4,
    padding: 10,
  },
  footer: {
    left: 58,
    position: 'absolute',
    right: 58,
    top: 805,
  },
  footerPage: {
    color: '#688084',
    fontSize: 8,
    textAlign: 'center',
    width: '100%',
  },
});

const paragraphSets = [
  [
    'A useful system begins with a view of what can change and what must remain steady. The map is intentionally simple: observe a signal, name the decision it informs, and keep the evidence close enough to inspect.',
    'The strongest notes separate what happened from what it might mean. This makes later revisions easier because an interpretation can change without erasing the underlying observation.',
  ],
  [
    'Movement becomes easier to understand when measurements share a cadence. A repeated interval turns isolated facts into a sequence and reveals whether a change is persistent, temporary, or only noise.',
    'Each checkpoint should answer one practical question. Extra detail belongs only when it helps another reader reproduce the reasoning or recognize the same pattern in a different setting.',
  ],
  [
    'Constraints give a project its working shape. They reduce the number of possible moves, make tradeoffs visible, and create a common language for deciding what belongs in the next iteration.',
    'A clear boundary can still leave room for discovery. The aim is to protect the purpose of the work while allowing the method to improve as new evidence appears.',
  ],
] as const;

function Footer() {
  return (
    <View fixed style={styles.footer}>
      <Text
        render={({ pageNumber }) => (
          `FIELD NOTES / SYSTEMS IN MOTION    PAGE ${pageNumber}`
        )}
        style={styles.footerPage}
      />
    </View>
  );
}

export function createSampleDocument(
  entries: readonly ContentsEntry[],
): ReactElement<DocumentProps> {
  return (
    <Document
      author="Tevinch"
      creator="Data Shape Kit"
      subject="A fictional field report demonstrating verified PDF contents"
      title="Field Notes: Systems in Motion"
    >
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverRule} />
        <Text style={styles.eyebrow}>Fictional field report</Text>
        <Text style={styles.coverTitle}>Field Notes: Systems in Motion</Text>
        <Text style={styles.coverSummary}>
          A study of signals, constraints, and the quiet patterns that emerge when observations are arranged in sequence.
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Footer />
        <Contents entries={entries} title="Contents" />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <Footer />
        {chapterTitles.map((title, chapterIndex) => {
          const chapterNumber = chapterIndex + 1;
          const [firstParagraph, secondParagraph] = paragraphSets[chapterIndex % paragraphSets.length];
          return (
            <Fragment key={`chapter-${chapterNumber}`}>
              <Text minPresenceAhead={105} style={styles.chapterNumber}>
                Chapter {String(chapterNumber).padStart(2, '0')}
              </Text>
              <Text id={`chapter-${chapterNumber}`} minPresenceAhead={55} style={styles.chapterTitle}>
                {title}
              </Text>
              <Text id={`chapter-${chapterNumber}.observation`} minPresenceAhead={60} style={styles.subheading}>
                Observation
              </Text>
              <Text style={styles.paragraph}>{firstParagraph}</Text>
              <Text style={styles.paragraph}>{secondParagraph}</Text>
              <Text id={`chapter-${chapterNumber}.method`} minPresenceAhead={58} style={styles.subheading}>
                {chapterIndex % 3 === 0
                  ? 'Method and a longer description of the choices made along the way'
                  : 'Method'}
              </Text>
              <Text style={styles.paragraph}>
                Start with one visible input, follow it through the decision it changes, and record the result in language another reader can test. Repeat the same route before adding another variable.
              </Text>
              <Text id={`chapter-${chapterNumber}.detail`} minPresenceAhead={78} style={styles.subheading}>
                Supporting detail
              </Text>
              <Text style={styles.note}>
                Field note {chapterNumber}: keep the smallest useful unit of evidence, then connect it to the wider sequence only after its meaning is clear.
              </Text>
            </Fragment>
          );
        })}
      </Page>
    </Document>
  );
}
