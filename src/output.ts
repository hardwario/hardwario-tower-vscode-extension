/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import * as path from 'path';
import { env } from 'process';
import { execSync } from 'child_process';
import * as helpers from './helpers';

export default function getEnv() {
  const envClone = Object.create(process.env);

  if (!helpers.MACOS) {
    if (helpers.WINDOWS) {
      const vscodepath = process.env.VSCODE_PORTABLE;
      const towerPath = path.join(vscodepath, 'tower');
      const toolchainPath = path.join(towerPath, 'toolchain');
      const gitPath = path.join(toolchainPath, 'git');

      const makeBinPath = path.join(toolchainPath, 'make', 'bin');

      const gccPath = path.join(toolchainPath, 'gcc');
      const gccBinPath = path.join(gccPath, 'bin');
      const gccArmBinPath = path.join(gccPath, 'arm-none-eabi', 'bin');

      const gitCmdPath = path.join(gitPath, 'cmd');
      const gitUsrBinPath = path.join(gitPath, 'usr', 'bin');
      const gitMingw64BinPath = path.join(gitPath, 'mingw64', 'bin');

      const cmakePath = path.join(toolchainPath, 'cmake', 'bin');
      const ninjaPath = path.join(toolchainPath, 'ninja');

      if (helpers.isPortable()) {
        let systemCmdPath = execSync('where cmd.exe', { timeout: 5000 }).toString();
        systemCmdPath = systemCmdPath.replace(/(\r\n|\n|\r)/gm, '');
        systemCmdPath = systemCmdPath.substring(0, systemCmdPath.length - 8);

        envClone.PATH = `${makeBinPath};${gccBinPath};${gccArmBinPath};${gitCmdPath};${gitUsrBinPath};${gitMingw64BinPath};${cmakePath};${ninjaPath};${systemCmdPath}`;
        envClone.Path = `${makeBinPath};${gccBinPath};${gccArmBinPath};${gitCmdPath};${gitUsrBinPath};${gitMingw64BinPath};${cmakePath};${ninjaPath};${systemCmdPath}`;
        return envClone;
      }
      return envClone;
    } if (helpers.LINUX) {
      const vscodepath = process.env.VSCODE_PORTABLE;
      const towerPath = path.join(vscodepath, 'tower');
      const toolchainPath = path.join(towerPath, 'toolchain');

      const homePath = env.HOME;

      const makePath = path.join(toolchainPath, 'make');
      const gccArmBinPath = path.join(toolchainPath, 'gcc', 'bin');

      const cmakePath = path.join(toolchainPath, 'cmake', 'bin');
      const ninjaPath = path.join(toolchainPath, 'ninja');

      if (helpers.isPortable()) {
        envClone.PATH = `${homePath}/.local/bin:${makePath}:${gccArmBinPath}:${cmakePath}:${ninjaPath}:${process.env.PATH}`;
        envClone.Path = `${homePath}/.local/bin:${makePath}:${gccArmBinPath}:${cmakePath}:${ninjaPath}:${process.env.PATH}`;
        return envClone;
      }
      return envClone;
    }
  } else if (helpers.isPortable()) {
    const vscodepath = process.env.VSCODE_PORTABLE;

    const towerPath = path.join(vscodepath, 'tower');
    const toolchainPath = path.join(towerPath, 'toolchain');
    const gccPath = path.join(toolchainPath, 'gcc');
    const gccBinPath = path.join(gccPath, 'bin');
    const gccArmBinPath = path.join(gccPath, 'arm-none-eabi', 'bin');

    const cmakePath = path.join(toolchainPath, 'cmake', 'Cmake.app', 'Contents', 'bin');
    const ninjaPath = path.join(toolchainPath, 'ninja');

    envClone.PATH = `${gccBinPath}:${gccArmBinPath}:${cmakePath}:${ninjaPath}:${process.env.PATH}`;
    envClone.Path = `${gccBinPath}:${gccArmBinPath}:${cmakePath}:${ninjaPath}:${process.env.PATH}`;
  }
  return envClone;
}
