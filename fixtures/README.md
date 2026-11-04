# fixtures/ — test data both apps are held to

`snapshot-v2.json` is one vault written by DraconDex-EXE's `serializeVault`
(snapshot format 2). It has:
- a row of every entity family that syncs
- a relation chain through them all
- a pin, a Designer link and a Diviner entry pointing at each
- page blocks of every shape: a module page, a property, text, the shared
  element layout, an element's own page, and a borrowed view

Both apps' tests import it into an empty vault and expect every row back, with
nothing dropped:
- EXE: `electron/test/snapshot-fixture.test.mjs`
- APK: `flutter/test/snapshot_fixture_test.dart`

This is the "same JSON test set in both languages" that APK V3 needs, because
the two serializers must agree byte for byte.

It is written by DraconDex-EXE `tools/snapshot-fixture.mjs`, not by hand.
Regenerate it only when the snapshot format changes, commit it here, and
re-vendor both apps.

## stress-v2.json — the vault every performance number is measured on

Procress 19 part 1. 20 folders holding 500 Drafters (520 modules) and one
Classifier with 3,000 objects and 5,000 values — the same shape EXE's
`electron/test/perf.driver.mjs` builds through the UI. Written compact (one
line) by DraconDex-EXE `tools/stress-fixture.mjs`, deterministic, and vendored
to:
- EXE: `electron/test/fixtures/stress-v2.json`
- APK: `flutter/test/fixtures/stress-v2.json`, read by `test/perf_data_test.dart`

Regenerate it only when the snapshot format changes.

## portlink-merge-v1.json — the Port Link 3-way merge cases

Procress 32 9.0 (APP `docs/VAULTS.md` §11.6). Twelve cases — the owner's own
example (A renamed to B on the drive while this machine made C → B and C), a
conflict asked and a conflict answered, edit vs delete, new rows colliding on
id, every `idRefs` shape following a renumbered row, a tag both sides made,
join-table removals, a deleted parent coming back. Each case is SQL only, so
both engines run it as written: `seed` (+ `seedExtra`) on three vaults built
from the vault DDL, `local` on one, `drive` on another, then the merge;
`expect` is checked with queries that never assume an id made after the seed.

Written by hand (it is a statement of the rules, not an export), checked here
by `test/portlink-fixture.test.mjs` (the SQL runs; an expected conflict is one
the edits really make), and run through the real engines by:
- EXE: `electron/test/portlink-fixture.test.mjs` → `src/db/portlink-merge.js mergeInto`
- APK: `flutter/test/portlink_fixture_test.dart` → `portlink_merge.dart` (Plan part 9.4)

**A runner seeds once and copies.** Build the base from the vault DDL + `seed`
(+ `seedExtra`), close it, and copy that FILE to make this machine's and the
drive's databases — as real use does (the base and both sides are always
copies of one file). Seeding three databases separately gives the
`datetime('now')` defaults different seconds whenever the seeds straddle
one, and every row then reads as changed on the drive: EXE's first runner
failed `edit-beats-delete` that way, intermittently.

A change to a merge rule is a change here first; a case both engines fail on
the same way is the rule, a case only one fails is that engine's bug.
