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
