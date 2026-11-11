const {
  withMainActivity,
  withMainApplication,
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
  createRunOncePlugin,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PKG_NAME = "withAndroidScreenShare";
const PKG_VERSION = "1.0.0";

const IC_NOTIFICATION_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
  <path
      android:fillColor="#FFFFFFFF"
      android:pathData="M20,18c1.1,0 1.99,-0.9 1.99,-2L22,6c0,-1.1 -0.9,-2 -2,-2H4c-1.1,0 -2,0.9 -2,2v10c0,1.1 0.9,2 2,2H0v2h24v-2h-4zM4,6h16v10H4V6z"/>
</vector>
`;

function modifyMainActivity(config) {
  return withMainActivity(config, (config) => {
    let content = config.modResults.contents;
    const importStatement = "import com.oney.WebRTCModule.WebRTCModuleOptions";
    const enableOption = "WebRTCModuleOptions.getInstance().enableMediaProjectionService = true";

    if (!content.includes(importStatement)) {
      content = content.replace(/(package [^\n]+)/, `$1\n\n${importStatement}`);
    }

    if (!content.includes(enableOption)) {
      if (content.includes("super.onCreate(")) {
        content = content.replace(
          /(super\.onCreate\([^\)]*\))/,
          `$1\n    ${enableOption}`
        );
      } else {
        content = content.replace(
          /(fun onCreate[^{]*\{)/,
          `$1\n    ${enableOption}`
        );
      }
    }

    config.modResults.contents = content;
    return config;
  });
}

function modifyMainApplication(config) {
  return withMainApplication(config, (config) => {
    let content = config.modResults.contents;
    const importStatement = "import com.oney.WebRTCModule.WebRTCModuleOptions";
    const enableOption = "WebRTCModuleOptions.getInstance().enableMediaProjectionService = true";

    if (!content.includes(importStatement)) {
      content = content.replace(/(package [^\n]+)/, `$1\n\n${importStatement}`);
    }

    if (!content.includes(enableOption)) {
      if (content.includes("super.onCreate()")) {
        content = content.replace(
          /(super\.onCreate\(\))/,
          `$1\n    ${enableOption}`
        );
      } else {
        content = content.replace(
          /(fun onCreate[^{]*\{)/,
          `$1\n    ${enableOption}`
        );
      }
    }

    config.modResults.contents = content;
    return config;
  });
}

function modifyAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = "com.oney.WebRTCModule.MediaProjectionService";
    const existingService = mainApplication.service.find(
      (s) => s.$ && s.$["android:name"] === serviceName
    );

    if (existingService) {
      existingService.$["android:foregroundServiceType"] = "mediaProjection";
    } else {
      mainApplication.service.push({
        $: {
          "android:name": serviceName,
          "android:foregroundServiceType": "mediaProjection",
        },
      });
    }

    return config;
  });
}

const IC_NOTIFICATION_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAApklEQVR4nO2YQQ6AIAwExfj/L+NJQwigEJrNJjNHvXQ7xQaPAwBASaof5JyzopAZUkpv3aeykB3YB7hGL0tVanqjbW+AAGoIoCY8QPRixMCIp/uRFjDQo+56lAUMtOh1O8ICBmq+urzbAgZK/nZ3p4XhhWYWxQWIEVJDADX2AYZfIYe/dPYG7AOELZ7W+EUsOnsDBFBjH2D5UEXsiJVDbm+AAACg5QZm/kAkHdch/QAAAABJRU5ErkJggg==";

function copyNotificationIcon(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const resPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res"
      );

      const drawableDir = path.join(resPath, "drawable");
      if (!fs.existsSync(drawableDir)) {
        fs.mkdirSync(drawableDir, { recursive: true });
      }

      // Write vector drawable XML into res/drawable/ic_notification.xml
      const iconXmlPath = path.join(drawableDir, "ic_notification.xml");
      fs.writeFileSync(iconXmlPath, IC_NOTIFICATION_XML, "utf8");

      // Write raster fallback PNGs ONLY into density folders (mdpi, hdpi, etc.), NOT root drawable/
      const pngBuffer = Buffer.from(IC_NOTIFICATION_PNG_BASE64, "base64");
      const densityDirs = [
        "drawable-mdpi",
        "drawable-hdpi",
        "drawable-xhdpi",
        "drawable-xxhdpi",
        "drawable-xxxhdpi",
      ];

      for (const dirName of densityDirs) {
        const targetDir = path.join(resPath, dirName);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.writeFileSync(path.join(targetDir, "ic_notification.png"), pngBuffer);
      }

      return config;
    },
  ]);
}

function withAndroidScreenShare(config) {
  // 1. Add permissions (FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PROJECTION, POST_NOTIFICATIONS)
  config = AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
    "android.permission.POST_NOTIFICATIONS",
  ]);

  // 2. Modify AndroidManifest.xml
  config = modifyAndroidManifest(config);

  // 3. Enable WebRTCModuleOptions in MainActivity.kt
  config = modifyMainActivity(config);

  // 4. Enable WebRTCModuleOptions in MainApplication.kt
  config = modifyMainApplication(config);

  // 5. Create ic_notification.xml in res/drawable
  config = copyNotificationIcon(config);

  return config;
}

module.exports = createRunOncePlugin(withAndroidScreenShare, PKG_NAME, PKG_VERSION);
