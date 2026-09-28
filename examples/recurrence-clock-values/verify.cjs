const assert = require('node:assert/strict');

function verify({ rrulestr }) {
  const text = 'DTSTART:20080101T090000Z\nRRULE:FREQ=MINUTELY;COUNT=12;BYSECOND=0,30,0';
  const expected = Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(2008, 0, 1, 9, 0, 0) + i * 30000).toISOString());
  for (const cache of [false, true]) {
    const set = rrulestr(text, { forceset: true, cache });
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.deepEqual(set.between(new Date('2008-01-01T00:00:00Z'),
        new Date('2009-01-01T00:00:00Z'), true).map(date => date.toISOString()), expected);
    }
    assert.equal(set.toString(), text);
  }
  return { count: expected.length, first: expected[0], last: expected[11],
    cacheModes: 2, queriesPerMode: 2, originalSerializationPreserved: true };
}

module.exports = verify;
if (require.main === module) console.log(JSON.stringify(verify(require('rrule')), null, 2));
