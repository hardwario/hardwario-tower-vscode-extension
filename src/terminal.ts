/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import * as vscode from 'vscode';
import * as path from 'path';
import { env } from 'process';
import * as helpers from './helpers';

/**
 * Terminal class for each terminal used by this extension
 */

class Terminal {
  name: string;

  instance: any;

  constructor(name : string) {
    this.instance = null;
    this.name = name;
  }

  /**
     * Creates the terminal with given specification based on if the VSCode
     * is portable or normally installed
     * @returns instance of the terminal
     */
  get() {
    if (this.instance === null) {
      const envClone = Object.create(process.env);

      if (!helpers.MACOS) {
        const vscodepath = process.env.VSCODE_CWD;
        const towerPath = path.join(vscodepath, 'data', 'tower');
        const pythonPath = path.join(towerPath, 'python');
        const toolchainPath = path.join(towerPath, 'toolchain');
        const gitPath = path.join(toolchainPath, 'git');

        if (helpers.WINDOWS) {
          const pythonScriptsPath = path.join(pythonPath, 'Scripts');

          const makeBinPath = path.join(toolchainPath, 'make', 'bin');

          const gccPath = path.join(toolchainPath, 'gcc');
          const gccBinPath = path.join(gccPath, 'bin');
          const gccArmBinPath = path.join(gccPath, 'arm-none-eabi', 'bin');

          const gitCmdPath = path.join(gitPath, 'cmd');
          const gitUsrBinPath = path.join(gitPath, 'usr', 'bin');
          const gitMingw64BinPath = path.join(gitPath, 'mingw64', 'bin');

          if (helpers.isPortable()) {
            envClone.PATH = `${pythonPath};${pythonScriptsPath};${makeBinPath};${gccBinPath};${gccArmBinPath};${gitCmdPath};${gitUsrBinPath};${gitMingw64BinPath}`;
            envClone.Path = `${pythonPath};${pythonScriptsPath};${makeBinPath};${gccBinPath};${gccArmBinPath};${gitCmdPath};${gitUsrBinPath};${gitMingw64BinPath}`;
          }
        } else if (helpers.LINUX) {
          const homePath = env.HOME;

          const pythonBinPath = path.join(pythonPath, 'install', 'bin');
          const makePath = path.join(toolchainPath, 'make');
          const gccArmBinPath = path.join(toolchainPath, 'gcc', 'bin');

          if (helpers.isPortable()) {
            envClone.PATH = `${homePath}/.local/bin:${pythonBinPath}:${makePath}:${gccArmBinPath}:${process.env.PATH}`;
            envClone.Path = `${homePath}/.local/bin:${pythonBinPath}:${makePath}:${gccArmBinPath}:${process.env.PATH}`;
          }
        }
      } else
      if (helpers.isPortable()) {
        const vscodepath = process.env.VSCODE_PORTABLE;

        const towerPath = path.join(vscodepath, 'tower');
        const toolchainPath = path.join(towerPath, 'toolchain');
        const gccPath = path.join(toolchainPath, 'gcc');
        const gccBinPath = path.join(gccPath, 'bin');
        const gccArmBinPath = path.join(gccPath, 'arm-none-eabi', 'bin');

        envClone.PATH = `${gccBinPath}:${gccArmBinPath}:${process.env.PATH}`;
        envClone.Path = `${gccBinPath}:${gccArmBinPath}:${process.env.PATH}`;
      }

      this.instance = vscode.window.createTerminal({
        name: this.name,
        env: envClone,
      });
      return this.instance;
    }

    return this.instance;
  }
}

export default Terminal;
