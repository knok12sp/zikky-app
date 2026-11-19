import { useFonts } from "expo-font";

/**
 * Static faces, one family per weight. Kept in its own module so tests can
 * stub font loading without Vite trying to transform .ttf requires.
 */
export const fontAssets = {
  Archivo: require("../assets/fonts/Archivo-Regular.ttf"),
  ArchivoMedium: require("../assets/fonts/Archivo-Medium.ttf"),
  ArchivoBold: require("../assets/fonts/Archivo-Bold.ttf"),
  IBMPlexMono: require("../assets/fonts/IBMPlexMono-Regular.ttf"),
  IBMPlexMonoMedium: require("../assets/fonts/IBMPlexMono-Medium.ttf"),
};

export function useAppFonts() {
  return useFonts(fontAssets);
}
