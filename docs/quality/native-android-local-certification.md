# Native Android Local Certification

Native Android local certification packages MerHouse as a literal Android debug APK for local proof while reusing the existing React frontend and Spring Boot API.

The native layer is the mobile product track for local certification. Shared web metadata, manifest, service worker, and icon files remain only as shell inputs for the web runtime and Capacitor package; they are not a separate mobile product.

## Boundary

Native mobile local certification includes:

- Capacitor Android project under `frontend/android`
- native Android app id `com.merhouse.operations`
- Android launcher activity and app label
- launcher icons that use the MerHouse brand mark identity from the shared app icon source
- local emulator/API base support through `VITE_API_BASE_URL`
- local cleartext HTTP only for the emulator-to-backend development path
- structural native wrapper check, including shell-only source enforcement
- native sync check that builds `frontend/dist` and copies it into Android
- debug APK assembly when Android SDK is available

Native mobile local certification does not include:

- Google Play or Apple App Store release
- Android App Bundle release signing
- iOS project generation
- native OS notification delivery or push provider rollout
- native barcode/camera workflows
- offline write queues or conflict resolution
- production mobile monitoring, crash reporting, or release operations

Those provider and release steps belong to V17 production activation or VInfinite product expansion.

## Runtime Shape

The Android app is built from the frontend package:

| Path | Role |
| --- | --- |
| `frontend/capacitor.config.ts` | Capacitor app id, app name, web output directory, and Android scheme |
| `frontend/android` | Generated Android wrapper source |
| `frontend/public/app-icon.svg` | Shared web shell app icon source identity |
| `frontend/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png` | Native adaptive launcher foregrounds generated from the same identity |
| `frontend/dist` | React build consumed by Capacitor sync |
| `scripts/proof/android/native-mobile-check.ps1` | Structural, sync, and APK assembly proof |
| `scripts/proof/android/native-android-tour.ps1` | Installed-APK route tour and screenshot proof |

For an Android emulator, build the native shell with:

```powershell
.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://10.0.2.2:8080"
```

For a physical Android device on the same network, pass the computer LAN URL:

```powershell
.\scripts\proof\android\native-mobile-check.ps1 -Assemble -ApiBaseUrl "http://192.168.1.10:8080"
```

The debug APK is written to:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

The native check validates `-ApiBaseUrl` through the shared URL guard as a non-blank absolute `http` or `https` URL, applies the native build rule that it must not end with a trailing slash, and defaults it to `http://10.0.2.2:8080` unless overridden. Sync output prints the normalized API base and compiled JavaScript asset path that proves the Android-bound frontend uses that backend base. Its structural pass also rejects Android-wrapper source that duplicates product API paths, React route definitions, direct fetch logic, or frontend API-base wiring. Successful APK assembly output prints the normalized API base, APK SHA-256, and APK byte size. The CI native Android job assembles the debug APK with `-ApiBaseUrl "http://10.0.2.2:8080"` as a pass/fail build check only; it does not publish debug APK artifacts.

After the local stack is running and an Android emulator is booted, run the installed-app tour:

```powershell
.\scripts\proof\android\native-android-tour.ps1
```

This tour uses the real debug APK, not a browser viewport. It validates `-ApiUrl` as a non-blank absolute `http` or `https` URL and validates `-ApkPath`, `-OutputPath`, and `-ScreenshotDirectory` as non-blank paths before Android tooling starts. The wrapper prints the native API URL, resolved APK path, resolved report path, and resolved screenshot directory before SDK and device discovery, then checks public auth routes, logs in through the local backend, creates and authenticates a generated admin account plus generated empty merchant and warehouse accounts, injects the resulting token into the native WebView for repeatable automation, visits owner, generated admin, support-admin, auditor, active merchant, empty merchant, active warehouse, empty warehouse, notification, service, account, seeded platform relationship and inbound-stock detail routes, and discovered operational detail routes, and saves screenshots under `reports/`. Each pulled screenshot must be valid PNG evidence with positive dimensions before the route can pass. Protected routes that land on `/login` after token injection are rejected as bad records. The JSON report records API URL, APK path, APK SHA-256, APK byte size, checked timestamp, connected device serials, and active or empty stakeholder state for merchant and warehouse records so the proof identifies the installed artifact, Android runtime, proof time, and stakeholder-state coverage.

After the matching browser tour has run, compare the reports:

```powershell
.\scripts\proof\release\cross-surface-tour-check.ps1
```

The comparison normalizes role names and generated detail-route ids so the local APK proof can be checked against the shared web implementation without treating seeded UUID values as product differences.

After future Android proof, browser proof, cross-surface comparison, and the full deployment gate are green for workflow, packaging, local-boundary, or performance-sensitive changes, use the [cross-surface final live walkthrough checklist](cross-surface-convergence.md#final-live-walkthrough-checklist) for the reviewer/product-owner session. V16.2 recorded that real installed-app and browser walkthrough in the convergence ledger.

## Acceptance Bar

Do not call native mobile local certification complete until:

- native structural check passes
- native sync check passes
- native launcher icon checks pass and no Android template icon assets remain
- Android debug APK assembly passes on a machine or CI runner with Android SDK
- installed-APK route tour passes on a running emulator with route-specific settled content and valid PNG screenshot evidence instead of loading, restoring-session, or placeholder shells
- installed-APK tour reports identify the API URL, APK fingerprint, APK size, checked timestamp, checked-route count, and Android device or emulator used for the proof
- installed-APK route records have exact normalized web/native route-set equality and valid PNG screenshot evidence through `.\scripts\proof\release\cross-surface-tour-check.ps1`
- docs clearly state that mobile certification is native Android packaging backed by one shared frontend shell
- the native wrapper reuses the same frontend build without duplicated workflow implementation
- the local backend boundary remains explicit
- final V16.2 convergence recorded the real installed-app and browser walkthrough in the cross-surface evidence ledger; repeat that live proof for later workflow, packaging, local-boundary, or performance-sensitive changes

## Local Tooling Note

Android APK assembly requires Android SDK and Java 17 or 21. The native check prefers `ANDROID_HOME` or `ANDROID_SDK_ROOT`, then standard Windows, macOS, and Linux SDK locations. It uses `java` on `PATH`, a compatible `JAVA_HOME`, or common JDK 17/21 install folders. If the local workstation does not have a compatible SDK or JDK, `native-mobile-check.ps1 -Assemble` stops with a setup message instead of pretending APK proof passed.

The installed-app tour also searches those SDK locations and `PATH` for `adb`, but it still requires a running emulator. That requirement is intentional because the proof is an actual installed APK tour, not a browser simulation.
