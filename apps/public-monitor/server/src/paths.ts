// This module and the production bundle are both one directory below server/.
export const pinnedDataDirectory = new URL("../data/public-monitor/", import.meta.url);
export const webDirectory = new URL("../../web/dist/", import.meta.url);
