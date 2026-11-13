import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

/** 首次安装时打开设置页，方便填写领星密钥 */
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') browser.runtime.openOptionsPage();
  });
});
