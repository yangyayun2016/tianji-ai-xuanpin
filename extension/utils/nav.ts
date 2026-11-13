import { browser } from 'wxt/browser';

/** 插件内用 runtime.getURL；普通网页预览（http.server）时退回相对路径 */
export function pageUrl(path: string): string {
  try {
    return browser.runtime.getURL(path as '/report.html');
  } catch {
    return path.replace(/^\//, '');
  }
}

export function openOptions(): void {
  try {
    browser.runtime.openOptionsPage();
  } catch {
    location.href = 'options.html';
  }
}
