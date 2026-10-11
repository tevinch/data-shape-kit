const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { Sequelize, DataTypes, Transaction } = require('sequelize');

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

// Replace the existing hook; keep the same wrapper and model instance.
function installRefresh(Item, findWrapper) {
  Item.afterUpdate('refresh-wrapper', (instance, options) => {
    const refresh = () => findWrapper(instance)?.onChanged();
    if (options.transaction) {
      options.transaction.afterCommit(refresh);
      return;
    }
    return refresh();
  });
}

(async () => {
  const directory = mkdtempSync(join(tmpdir(), 'committed-refresh-'));
  const key = randomBytes(24).toString('hex');
  const statements = [];
  const db = new Sequelize('main', '', key, {
    database: 'main', password: key, dialect: 'sqlite',
    dialectModulePath: '@journeyapps/sqlcipher',
    storage: join(directory, 'sample.db'),
    logging: text => { if (!/pragma\s+key/i.test(text)) statements.push(text); },
    define: { freezeTableName: true, timestamps: false },
  });
  try {
    for (const pragma of [
      'cipher_compatibility = 4', 'cipher_use_hmac = ON',
      'cipher_kdf_algorithm = PBKDF2_HMAC_SHA1', 'cipher_hmac_algorithm = HMAC_SHA1',
      'cipher_page_size = 4096', "cipher = 'aes-256-cbc'", 'kdf_iter = 256000',
      'cipher_plaintext_header_size = 0',
    ]) await db.query(`PRAGMA ${pragma}`);
    await db.query(`PRAGMA key = '${key}'`);
    const [cipher] = await db.query('PRAGMA cipher_version');
    assert.match(cipher[0].cipher_version, /^4\.4\.2/);
    const [wal] = await db.query('PRAGMA journal_mode=WAL');
    assert.equal(wal[0].journal_mode, 'wal');
    const Item = db.define('Item', { value: DataTypes.INTEGER });
    await Item.sync();
    const item = await Item.create({ value: 1 });
    const original = item;
    let refreshCalls = 0;
    let hookCalls = 0;
    let gate;
    let entered;
    let rejectRefresh = false;
    const displays = [];
    const wrapper = {
      async onChanged() {
        refreshCalls++;
        if (entered) entered.resolve();
        if (gate) await gate.promise;
        if (rejectRefresh) throw new Error('refresh unavailable');
        // Never reuse the completed transaction for this read.
        assert.equal(await item.reload({ transaction: null }), original);
        displays.push(item.value);
      },
    };
    installRefresh(Item, instance => {
      assert.equal(instance.id, item.id);
      return wrapper;
    });
    Item.afterUpdate('observe-hook', () => { hookCalls++; });
    const independentRead = async () => (await Item.findByPk(item.id, { transaction: null })).value;
    const report = { node: process.version, sequelize: Sequelize.version, driver: require('@journeyapps/sqlcipher/package.json').version, cipher: cipher[0].cipher_version, journalMode: wal[0].journal_mode, checks: [] };

    // An awaited save does not make an out-of-transaction hook read safe.
    const start = statements.length;
    await db.transaction({ type: Transaction.TYPES.IMMEDIATE, autocommit: true }, async transaction => {
      item.value = 2;
      await item.save({ transaction });
    });
    assert.equal(await independentRead(), 2);
    assert.equal(hookCalls, 1, 'the original afterUpdate hook must actually run');
    assert.equal(refreshCalls, 1, 'the wrapper must actually reload');
    assert.equal(item.value, 2, 'wrapper must retain the value that was committed');
    assert.deepEqual(displays, [2], 'client-side recalculation must receive the committed value');
    report.checks.push({ scenario: 'awaited save and wrapper reload', value: item.value, statements: statements.slice(start) });

    // A real asynchronous refresh must keep the next FIFO job from starting.
    entered = deferred();
    gate = deferred();
    let nextStarted = false;
    let settled = false;
    const first = db.transaction({ type: Transaction.TYPES.IMMEDIATE, autocommit: true }, async transaction => {
      item.value = 3;
      await item.save({ transaction });
    });
    first.then(() => { settled = true; }, () => { settled = true; });
    const second = first.then(async () => {
      nextStarted = true;
      assert.equal(item.value, 3);
      await db.transaction({ type: Transaction.TYPES.IMMEDIATE, autocommit: true }, async transaction => {
        item.value = 4;
        await item.save({ transaction });
      });
    });
    await entered.promise;
    assert.equal(await independentRead(), 3, 'refresh starts after the write is visible independently');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    assert.equal(nextStarted, false);
    const release = gate;
    gate = undefined;
    entered = undefined;
    release.resolve();
    await second;
    assert.equal(hookCalls, 3);
    assert.equal(refreshCalls, 3);
    assert.deepEqual(displays, [2, 3, 4]);
    assert.equal(await independentRead(), 4);
    assert.equal(item, original);
    report.checks.push({ scenario: 'three sequential saves and delayed refresh', displays: [...displays], hookCalls, refreshCalls });

    await assert.rejects(db.transaction({ type: Transaction.TYPES.IMMEDIATE, autocommit: true }, async transaction => {
      item.value = 5;
      await item.save({ transaction });
      throw new Error('cancel this write');
    }), /cancel this write/);
    assert.equal(hookCalls, 4, 'rollback scenario must reach afterUpdate');
    assert.equal(refreshCalls, 3, 'rollback must not notify the wrapper');
    assert.equal(await independentRead(), 4);
    assert.deepEqual(displays, [2, 3, 4]);
    // Sequelize does not restore an in-memory model after rollback.
    await item.reload({ transaction: null });
    assert.equal(item.value, 4);
    report.checks.push({ scenario: 'rollback', hookCalls, refreshCalls, stored: 4 });

    item.value = 6;
    await item.save();
    assert.equal(hookCalls, 5);
    assert.equal(refreshCalls, 4);
    assert.equal(displays.at(-1), 6);
    assert.equal(await independentRead(), 6);
    report.checks.push({ scenario: 'save without transaction', stored: 6, displayed: displays.at(-1) });

    rejectRefresh = true;
    await assert.rejects(db.transaction({ type: Transaction.TYPES.IMMEDIATE, autocommit: true }, async transaction => {
      item.value = 7;
      await item.save({ transaction });
    }), /refresh unavailable/);
    assert.equal(await independentRead(), 7, 'refresh failure must not be mistaken for a rolled-back write');
    rejectRefresh = false;
    await wrapper.onChanged();
    assert.equal(item.value, 7);
    assert.equal(displays.at(-1), 7);
    report.checks.push({ scenario: 'failed refresh after commit, read-only retry', committed: 7, displayedAfterRetry: 7 });

    // An update through a different instance still refreshes the existing wrapper.
    const outside = await Item.findByPk(item.id);
    outside.value = 8;
    await outside.save();
    assert.equal(item, original);
    assert.equal(item.value, 8);
    assert.equal(displays.at(-1), 8);
    assert.equal(await independentRead(), 8);
    assert.equal(hookCalls, 7);
    assert.equal(refreshCalls, 7);
    report.checks.push({ scenario: 'write outside wrapper', originalInstancePreserved: true, stored: 8, displayed: 8 });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.close();
    rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
