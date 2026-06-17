import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import path from "node:path";

const appBundleId = "com.pluma.app";
const appCopyright = "Copyright (c) 2026 Pluma contributors";
const appleIdentity = process.env.PLUMA_APPLE_IDENTITY;
const appleId = process.env.PLUMA_APPLE_ID;
const appleIdPassword = process.env.PLUMA_APPLE_ID_PASSWORD;
const appleTeamId = process.env.PLUMA_APPLE_TEAM_ID;
const shouldSign = Boolean(appleIdentity);
const shouldNotarize = Boolean(
  appleIdentity && appleId && appleIdPassword && appleTeamId
);
const ripgrepResourcePath = path.resolve(
  __dirname,
  "../../node_modules/@vscode",
  `ripgrep-${process.platform}-${process.arch}`,
  "bin"
);

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId,
    appCategoryType: "public.app-category.productivity",
    appCopyright,
    executableName: "Pluma",
    extraResource: [ripgrepResourcePath],
    helperBundleId: `${appBundleId}.helper`,
    icon: [
      `${path.resolve(__dirname, "assets/icon")}.icns`,
      `${path.resolve(__dirname, "assets/icon")}.icon`
    ],
    ...(shouldSign
      ? {
          osxSign: {
            identity: appleIdentity!
          }
        }
      : {}),
    ...(shouldNotarize
      ? {
          osxNotarize: {
            appleId: appleId!,
            appleIdPassword: appleIdPassword!,
            teamId: appleTeamId!
          }
        }
      : {}),
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeExtensions: ["md"],
          CFBundleTypeName: "Markdown Document",
          CFBundleTypeRole: "Editor",
          LSHandlerRank: "Owner"
        }
      ]
    }
  },
  rebuildConfig: {},
  makers: [new MakerDMG({}), new MakerZIP({}, ["darwin"])],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main"
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload"
        }
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts"
        }
      ]
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};

export default config;
