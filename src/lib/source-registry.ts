import {
  CUSTOM_SOURCES_KEY,
  DEFAULT_SOURCES
} from "../data/sources";
import type { ElectionSource } from "../types/election";

export function deriveStatewiseUrl(summaryJsonUrl: string, stateCode: string) {
  return new URL(`statewise${stateCode}1.htm`, summaryJsonUrl).toString();
}

export function parseCustomSourceUrls(value: string): ElectionSource[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((summaryJsonUrl, index) => ({
      id: `custom-${index}-${summaryJsonUrl}`,
      label: `Custom feed ${index + 1}`,
      summaryJsonUrl
    }));
}

export function readCustomSources(): ElectionSource[] {
  try {
    return parseCustomSourceUrls(localStorage.getItem(CUSTOM_SOURCES_KEY) ?? "");
  } catch {
    return [];
  }
}

export function writeCustomSourceText(value: string) {
  localStorage.setItem(CUSTOM_SOURCES_KEY, value);
}

export function readCustomSourceText() {
  try {
    return localStorage.getItem(CUSTOM_SOURCES_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getRegisteredSources(customText?: string): ElectionSource[] {
  const customSources =
    customText === undefined ? readCustomSources() : parseCustomSourceUrls(customText);
  return [...DEFAULT_SOURCES, ...customSources];
}
