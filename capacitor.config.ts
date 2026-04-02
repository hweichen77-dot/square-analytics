import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.walleys.analytics',
  appName: "Walley's Analytics",
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  // Square OAuth deep link: walleys://square/callback
  //
  // iOS (after `npx cap add ios`):
  //   Xcode → project target → Info → URL Types → add "walleys" identifier + "walleys" scheme
  //   Or add to ios/App/App/Info.plist:
  //   <key>CFBundleURLTypes</key>
  //   <array><dict>
  //     <key>CFBundleURLName</key><string>com.walleys.analytics</string>
  //     <key>CFBundleURLSchemes</key><array><string>walleys</string></array>
  //   </dict></array>
  //
  // Android (after `npx cap add android`):
  //   In android/app/src/main/AndroidManifest.xml, inside the <activity> tag:
  //   <intent-filter android:autoVerify="true">
  //     <action android:name="android.intent.action.VIEW" />
  //     <category android:name="android.intent.category.DEFAULT" />
  //     <category android:name="android.intent.category.BROWSABLE" />
  //     <data android:scheme="walleys" android:host="square" android:pathPrefix="/callback" />
  //   </intent-filter>
}

export default config
