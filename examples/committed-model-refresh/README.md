# Refresh a model wrapper after a committed save

In Sequelize 6, `afterUpdate` runs after the update query, while its transaction may still be open. Reloading a shared model on another connection from that hook can replace its values with the old committed row. This is the hook interaction identified by N247S in [Sequelize #18344](https://github.com/sequelize/sequelize/issues/18344#issuecomment-6102126466).

The existing [`transaction.afterCommit`](https://sequelize.org/docs/v6/other-topics/transactions/#the-aftercommit-hook) API provides the needed ordering. The hook's second argument contains [`options.transaction`](https://sequelize.org/docs/v6/other-topics/hooks/#hooks-and-transactions).

Replace the existing refresh hook with this pattern, using your existing model, hook name and wrapper lookup:

```js
MyModel.afterUpdate(hookID, (instance, options) => {
  const refresh = () => findWrapper(instance)?.onChanged();
  if (options.transaction) {
    options.transaction.afterCommit(refresh);
    return;
  }
  return refresh();
});
```

Make the wrapper return its complete refresh promise:

```js
async onChanged() {
  await this.myModel.reload({ transaction: null });
  await this.recalculateForDisplay();
}
```

`transaction: null` explicitly keeps this read outside the completed transaction. Rename `recalculateForDisplay` to your existing display calculation. Do not leave the old eager-reload hook installed alongside this one.

Keep mutation and the awaited managed transaction in the same FIFO job:

```js
await sequelize.transaction(
  { type: Transaction.TYPES.IMMEDIATE, autocommit: true },
  async transaction => {
    myModel.value = nextValue;
    await myModel.save({ transaction });
  },
);
// The returned refresh promise has settled before this job finishes.
```

Do not return a promise from `afterUpdate` that waits for the commit itself: the transaction is still waiting for `save`, so that creates a deadlock. Register the callback and return, as above. For a save without a transaction, return the refresh directly so the save waits for it.

## Run the complete check

The example uses Sequelize 6.37.8 and `@journeyapps/sqlcipher` 5.3.1, matching the report. With Node.js 24 and npm:

```sh
npm ci --ignore-scripts
node node_modules/@mapbox/node-pre-gyp/bin/node-pre-gyp install --directory=node_modules/@journeyapps/sqlcipher --fallback-to-build=false
node check.cjs
```

The second command downloads the driver's official prebuilt binary and fails if your platform has no matching binary. It does not fall back to a local native build. The check creates and removes its own temporary database, generates its own disposable key, preserves the report's cipher settings, and independently confirms SQLCipher and WAL are active. It never opens an existing application database.

Verified on macOS arm64 with Node 24.19.0 and SQLCipher 4.4.2:

- The eager-reload control failed: the database contained `2`, while the same wrapper instance displayed `1`.
- Three updates reused one model instance and displayed `2`, `3`, then `4`. A deliberately paused refresh held the next FIFO job until it finished; an independent connection already saw the committed write.
- A rolled-back update invoked `afterUpdate` but never refreshed the wrapper. A save without a transaction waited for its refresh.
- A refresh error after commit left the write persisted. Retrying just the read/display refresh restored the view.
- Saving a separate instance of the same row refreshed the original wrapper, preserving its identity.

These are scripted database checks, not Electron or original-application validation. The check asserts hook and refresh counts outside their callbacks and reads stored values independently.

## Boundaries

This pattern covers top-level transactions and instance saves. Nested savepoints, bulk updates without individual hooks, raw SQL and writes from another process need their own notification design. Existing unrelated hooks remain active; callers must replace the specific eager-refresh hook.

A rollback does not restore Sequelize's in-memory instance automatically; decide how your application restores or retains unsaved edits. A refresh failure after a successful commit does not undo the write, so retry the read/display work rather than blindly resubmitting the write. This example does not provide crash-proof notifications or a guarantee about failed database commits. Keep every mutation of a shared model in the same application queue.

The example is MIT licensed under the repository's [LICENSE](../../LICENSE). It applies the documented Sequelize API; it is not a library patch.

## Optional coffee

The example is free. If it saves you time and you would like to buy me a coffee, thank you. It is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
