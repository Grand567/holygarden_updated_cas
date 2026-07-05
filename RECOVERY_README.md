# holy-garden-app — Source Recovered from app-debug.apk

Extracted and reconstructed on 2026-06-24 from `app-debug.apk` (Capacitor/Android build).

## What this is

This APK is a **Capacitor app**, meaning the real application logic lives as plain
web assets (HTML/CSS/JS) bundled inside, rather than compiled into native code.
That made recovery much more complete than it would be for a pure native Android app.

## Recovery quality by file type

| Files | Status |
|---|---|
| `*.html`, `*.css`, `manifest.json`, `capacitor.config.json`, `capacitor.plugins.json`, images, `libs/*` | **100% original** — copied byte-for-byte from the APK, untouched. |
| `config.example.js`, `native-bridge.js` | **100% original** — not obfuscated, comments intact. |
| `cas-config.js` | **Original or near-original** — comments and Devanagari documentation survived intact. Possibly was never obfuscated. |
| `admin-app.js`, `accountant-app.js`, `parent-app.js`, `app-core.js`, `app-views.js`, `config.js`, `shared.js` | **Reconstructed from obfuscated bytecode-style JS.** These had been run through a JS obfuscator (hex `_0x...` names, string-array encoding, flattened control flow) before being built into the APK. |

## How the JS reconstruction was done

1. **webcrack** — decoded the string-array obfuscation and unflattened control flow.
   This recovers all string literals, all imported/exported names, and all
   top-level/global names exactly (since those identifiers are referenced by name
   across files and weren't mangled).
2. **Custom Babel pass** — renamed remaining local-scope hex identifiers
   (function parameters, intermediate variables) to short sequential names
   (`v1`, `v2`, `v3`...) and re-printed with standard formatting/indentation.

All 8 reconstructed files were validated with `node --check` and parse as valid JavaScript.

## Important: what this is NOT

This is **not your original source**. Specifically lost forever (the obfuscator
discards this information and it cannot be recovered by any tool):
- Original local variable and parameter names (e.g. whatever you originally called
  the variable that is now `v3`)
- Original inline comments inside the obfuscated files
- Original code formatting/style choices
- Git history, commit messages, file organization at the time of this build

Top-level/exported names, all strings (including API endpoints, error messages,
Supabase queries, UI text), and overall program structure/logic are intact and
should match your original behavior exactly.

## ⚠️ Security note

`config.js` contains a live-looking `GEMINI_API_KEY` shipped client-side in this
build. Any APK is trivially unpackable (as demonstrated here), so this key is
effectively public. Recommend rotating it and/or adding API restrictions
(HTTP referrer / Android app restriction) in Google Cloud Console if you haven't
already. The Supabase anon key is expected to be public by design (protected by
your RLS policies), and the eSewa secret present is eSewa's well-known public
sandbox/UAT credential, not a real merchant secret.

## Not included

The native Android/Java wrapper (`classes*.dex`) was not decompiled — for a
Capacitor app this is just Capacitor's own plugin-bridge boilerplate, not
your application code, so it wasn't worth the noise. Let me know if you want
it anyway.
