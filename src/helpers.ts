
export const WINDOWS = process.platform.startsWith('win');
export const OSX = process.platform == 'darwin';
export const LINUX = !WINDOWS && !OSX;

