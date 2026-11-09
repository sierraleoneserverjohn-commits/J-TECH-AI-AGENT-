import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

if (!fs.existsSync(androidDir)) {
  console.log('[patch-android] No android directory found. Skipping.');
  process.exit(0);
}

// 1. Patch AndroidManifest.xml
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  const permissions = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  ];

  for (const perm of permissions) {
    if (!manifest.includes(perm)) {
      manifest = manifest.replace('<manifest', `<manifest\n    ${perm}`);
    }
  }

  if (manifest.includes('activity android:name=".MainActivity"') && !manifest.includes('sensorLandscape')) {
    manifest = manifest.replace(
      'activity android:name=".MainActivity"',
      'activity android:name=".MainActivity" android:screenOrientation="sensorLandscape"'
    );
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('✓ Patched AndroidManifest.xml (Permissions & sensorLandscape)');
}

// 2. Ensure res/values directories, styles.xml, colors.xml
const valuesDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'values');
if (!fs.existsSync(valuesDir)) {
  fs.mkdirSync(valuesDir, { recursive: true });
}

const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#00f3ff</color>
    <color name="colorPrimaryDark">#05080f</color>
    <color name="colorAccent">#00f3ff</color>
    <color name="jexa_background">#05080f</color>
</resources>
`;
fs.writeFileSync(path.join(valuesDir, 'colors.xml'), colorsXml, 'utf8');

const stylesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowBackground">@color/jexa_background</item>
        <item name="android:colorBackground">@color/jexa_background</item>
        <item name="android:statusBarColor">@color/jexa_background</item>
        <item name="android:navigationBarColor">@color/jexa_background</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowContentOverlay">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme">
        <item name="android:background">@color/jexa_background</item>
    </style>
</resources>
`;
fs.writeFileSync(path.join(valuesDir, 'styles.xml'), stylesXml, 'utf8');
console.log('✓ Configured styles.xml and colors.xml (#05080f & shortEdges)');

// 3. Configure MainActivity.java for sticky immersive mode
const mainActivityPath = path.join(androidDir, 'app', 'src', 'main', 'java', 'com', 'jtech', 'jexa', 'MainActivity.java');
if (fs.existsSync(path.dirname(mainActivityPath))) {
  const mainActivityJava = `package com.jtech.jexa;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableStickyImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableStickyImmersiveMode();
        }
    }

    private void enableStickyImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }
    }
}
`;
  fs.writeFileSync(mainActivityPath, mainActivityJava, 'utf8');
  console.log('✓ Configured MainActivity.java (Sticky Immersive Mode)');
}
