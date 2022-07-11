/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SerialPort } from 'serialport';
import Terminal from './terminal';
import * as helpers from './helpers';

import PaletteProvider from './palette';

const commandExistsSync = require('command-exists').sync;

/**
 * Instances of all the available terminals
 */
const buildTerminal = new Terminal('HARDWARIO TOWER Build');
const flashTerminal = new Terminal('HARDWARIO TOWER Flash');
const flashAndLogTerminal = new Terminal('HARDWARIO TOWER Flash And Log');
const consoleTerminal = new Terminal('HARDWARIO TOWER Console');
const cleanTerminal = new Terminal('HARDWARIO TOWER Clean');
const cloneTerminal = new Terminal('HARDWARIO TOWER Clone');

let lastSelectedFolder = '';

/* Build type of the firmware */
let releaseType = 'debug';
let releaseBar: vscode.StatusBarItem;

let contextGlobal: vscode.ExtensionContext;

/* List of serial ports available for flashing */
let serialPorts;

/* Currently selected serial port (item on the bottom bar) */
let portSelection : vscode.StatusBarItem = null;

/* Actual name of currently selected serial port */
let selectedPort = '';

/* Index of currently selected device on serial port */
let deviceIndex = 0;

let preDebugBuildActive = false;

/**
 * Builds the project before the start of the debug session with Jlink
 */
function preDebugBuild() {
  vscode.workspace.saveAll();
  const command = helpers.buildMakeCommand('debug', true);
  buildTerminal.get().sendText(command);
  buildTerminal.get().show();
}

/**
 * Create, define and push the basic commands to the palette
 */
function pushGeneralCommands() {
  /**
   * Clone skeleton firmware from github and open it as a folder
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.clone_skeleton', async () => {
    if ((helpers.isPortable() && helpers.LINUX) || (!helpers.isPortable())) {
      helpers.checkCommand('git', "Please install git with 'sudo apt install git' and restart VSCode", 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    }

    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      title: 'Select parent folder for new firmware',
      openLabel: 'Select folder',
    };
    vscode.window.showOpenDialog(options).then((folderUri) => {
      if (folderUri) {
        let folderUriString = '';
        if (helpers.WINDOWS) {
          folderUriString = `${folderUri[0].path.substring(1)}/`;
        } else if (helpers.LINUX || helpers.MACOS) {
          folderUriString = `${folderUri[0].path}/`;
        }

        const inputOptions = {
          value: 'twr-skeleton',
          title: 'Skeleton firmware folder name',
        };

        vscode.window.showInputBox(inputOptions).then((text) => {
          if (text === undefined || text === '') {
            folderUriString += 'twr-skeleton';
          } else {
            folderUriString += text;
          }
          cloneTerminal.get().sendText(`git clone --recursive https://github.com/hardwario/twr-tester-chester-x0.git ${folderUriString} && exit`);
          cloneTerminal.get().show();
          vscode.workspace.saveAll();

          lastSelectedFolder = folderUriString;
        });
      }
    });
  }));

  /**
   * Clone selected firmware from the github and open it as a folder
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.clone_firmware', async () => {
    if ((helpers.isPortable() && helpers.LINUX) || (!helpers.isPortable())) {
      helpers.checkCommand('git', "Please install git with 'sudo apt install git' and restart VSCode", 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    }

    helpers.updateFirmwareJson()
      .then((data : string) => {
        const firmwareList = [];
        const json = JSON.parse(data);

        json.forEach((firmware) => {
          firmwareList.push({ label: firmware.name.split('/')[1], description: firmware.description, link: `${firmware.repository}.git` });
        });

        const quickPickOptions: vscode.QuickPickOptions = {
          placeHolder: 'Pick firmware template',
          canPickMany: false,
          title: 'Firmware template',
        };

        vscode.window.showQuickPick(
          firmwareList,
          quickPickOptions,
        ).then((pickedItem) => {
          if (pickedItem) {
            const options: vscode.OpenDialogOptions = {
              canSelectMany: false,
              canSelectFiles: false,
              canSelectFolders: true,
              title: 'Select parent folder for new firmware',
              openLabel: 'Select folder',
            };

            vscode.window.showOpenDialog(options).then((folderUri) => {
              if (folderUri) {
                let folderUriString = '';
                if (helpers.WINDOWS) {
                  folderUriString = `${folderUri[0].path.substring(1)}/`;
                } else if (helpers.LINUX || helpers.MACOS) {
                  folderUriString = `${folderUri[0].path}/`;
                }

                const inputOptions = {
                  value: pickedItem.label,
                  title: 'Skeleton firmware folder name',
                };

                vscode.window.showInputBox(inputOptions).then((text) => {
                  if (text === undefined || text === '') {
                    folderUriString += pickedItem.label;
                  } else {
                    folderUriString += text;
                  }
                  cloneTerminal.get().sendText(`git clone --recursive ${pickedItem.link} ${folderUriString} && exit`);
                  cloneTerminal.get().show();
                  vscode.workspace.saveAll();

                  lastSelectedFolder = folderUriString;
                });
              }
            });
          }
        });
      })
      .catch(() => {});
  }));

  /**
   * Open documentation website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.open_documentation', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/'));
  }));

  /**
   * Open SDK website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.open_sdk', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://sdk.hardwario.com/index.html'));
  }));

  /**
   * Open shop website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.open_shop', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://shop.hardwario.com'));
  }));

  /**
   * Open hackster.io projects website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.open_projects', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://www.hackster.io/hardwario/projects'));
  }));

  /**
   * Open company github page
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.open_github', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/hardwario'));
  }));

  /**
   * Open HARDWARIO Forum
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.open_forum', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://forum.hardwario.com'));
  }));

  /**
   * Open HARDWARIO main website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.open_website', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://www.hardwario.com/cs/kit/'));
  }));
}

/**
 * Create, define and push the advanced commands to the palette
 * when HARDWARIO TOWER firmware is opened
 */
function pushHardwarioCommands() {
  /**
   * Build code with make and create final binary
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.build', () => {
    vscode.workspace.saveAll();

    const command = helpers.buildMakeCommand(releaseType);
    buildTerminal.get().sendText(command);
    buildTerminal.get().show();
  }));

  /**
   * Build and upload the firmware to the selected connected device
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.flash', async () => {
    vscode.workspace.saveAll();

    if (consoleTerminal.instance !== null) {
      consoleTerminal.get().dispose();
      consoleTerminal.instance = null;
    }

    if (flashAndLogTerminal.instance !== null) {
      flashAndLogTerminal.get().dispose();
      flashAndLogTerminal.instance = null;
    }

    let command = helpers.buildMakeCommand(releaseType);
    if (selectedPort !== '') {
      command += ` && bcf flash --device ${selectedPort}`;
    } else {
      command += ' && bcf flash';
    }
    flashTerminal.get().sendText(command);
    flashTerminal.get().show();
  }));

  /**
   * Change selected device where the firmware should be uploaded to
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.change_device', async () => {
    if (serialPorts.length === 0) {
      return;
    }

    deviceIndex += 1;
    if (deviceIndex >= serialPorts.length) {
      deviceIndex = 0;
    }

    if (portSelection !== null) {
      portSelection.dispose();
      portSelection = null;
    }
    if (portSelection === null) {
      selectedPort = serialPorts[deviceIndex].path;
      portSelection = vscode.window.createStatusBarItem(
        'toolbar',
        vscode.StatusBarAlignment.Left,
        1,
      );

      portSelection.name = 'HARDWARIO: Toolbar';

      portSelection.text = `Device: ${serialPorts[deviceIndex].path} - ${serialPorts[deviceIndex].serialNumber.split('-').slice(0, 3).join('-')}`;

      portSelection.tooltip = 'HARDWARIO: Change device';
      portSelection.command = 'hardwario-tower.change_device';
      portSelection.show();
      contextGlobal.subscriptions.push(portSelection);
    }
  }));

  /**
   * Clear all builded binaries
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.clean', () => {
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    if (helpers.isCmakeProject()) {
      cleanTerminal.get().sendText('ninja -C obj/release clean');
      cleanTerminal.get().sendText('ninja -C obj/debug clean');
    } else {
      cleanTerminal.get().sendText('make clean');
    }
    fs.rmSync(path.join(workspaceFolder.uri.fsPath.toString(), 'out'), { recursive: true, force: true });
    fs.rmSync(path.join(workspaceFolder.uri.fsPath.toString(), 'obj'), { recursive: true, force: true });
    cleanTerminal.get().show();
  }));

  /**
   * Attach the console to the selected device for the logging messages
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.console', () => {
    if (consoleTerminal.instance !== null) {
      consoleTerminal.get().dispose();
      consoleTerminal.instance = null;
    }

    if (flashAndLogTerminal.instance !== null) {
      flashAndLogTerminal.get().dispose();
      flashAndLogTerminal.instance = null;
    }

    if (selectedPort !== '') {
      consoleTerminal.get().sendText(`bcf log --device ${selectedPort}`);
    } else {
      consoleTerminal.get().sendText('bcf log');
    }
    consoleTerminal.get().show();
  }));

  /**
   * Build and upload firmware to selected device.
   * After the upload the console will be attached to the device
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.flash_and_log', () => {
    vscode.workspace.saveAll();

    if (consoleTerminal.instance !== null) {
      consoleTerminal.get().dispose();
      consoleTerminal.instance = null;
    }

    if (flashAndLogTerminal.instance !== null) {
      flashAndLogTerminal.get().dispose();
      flashAndLogTerminal.instance = null;
    }

    let command = helpers.buildMakeCommand(releaseType);
    if (selectedPort !== '') {
      command += ` && bcf flash --log --device ${selectedPort} `;
    } else {
      command += ' && bcf flash --log';
    }
    flashAndLogTerminal.get().sendText(command);
    flashAndLogTerminal.get().show();
  }));

  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.flash_and_debug', async () => {
    preDebugBuild();
    preDebugBuildActive = true;
  }));

  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.debug', async () => {
    helpers.startDebug();
  }));

  /**
   * Change the type of builded firmware (debug/release)
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.change_release_type', () => {
    if (releaseType === 'debug') {
      releaseType = 'release';
    } else {
      releaseType = 'debug';
    }
    releaseBar.text = `Firmware type: ${releaseType}`;
  }));

  /**
   * Internal command that finds the arm toolchain based on the portable version
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.locate_toolchain', () => {
    if (helpers.isPortable()) {
      if (helpers.WINDOWS || helpers.LINUX) {
        return `${process.env.VSCODE_CWD}/data/tower/toolchain/gcc/bin/arm-none-eabi-gdb`;
      }
      if (helpers.MACOS) {
        return `${process.env.VSCODE_PORTABLE}/tower/toolchain/gcc/bin/arm-none-eabi-gdb`;
      }
    }
    return 'arm-none-eabi-gdb';
  }));

  /**
     * Internal command that finds the JLink based on the portable version
     */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.locate_jlink', () => {
    if (helpers.isPortable()) {
      if (helpers.WINDOWS) {
        return `${process.env.VSCODE_CWD}/data/tower/toolchain/SEGGER/JLink/JLinkGDBServerCL`;
      }
      if (helpers.MACOS) {
        return `${process.env.VSCODE_PORTABLE}/tower/toolchain/SEGGER/JLink/JLinkGDBServerCLExe`;
      }
      if (helpers.LINUX) {
        return `${process.env.VSCODE_CWD}/data/tower/toolchain/SEGGER/JLink/JLinkGDBServerCLExe`;
      }
    } else {
      if (helpers.LINUX || helpers.MACOS) {
        return 'JLinkGDBServerCLExe';
      }
      if (helpers.WINDOWS) {
        return 'JLinkGDBServerCL';
      }
    }
    return 'JLinkGDBServerCL';
  }));

  /**
   * Update firmware SDK
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.update_sdk', () => {
    buildTerminal.get().sendText('git submodule update --remote --merge sdk');
  }));

  /**
   * Upgrade firmware project from platformio
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario-tower.upgrade_firmware', () => {
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const workspacePath = workspaceFolder.uri.fsPath.toString();

    helpers.updateToSupportedFirmwareStructure(workspacePath, contextGlobal);
  }));
}

/**
 * Creates the icons on the bottom panel of the VSCode and assigns the commands to them
 * @param context vscode context
 */
function createToolbar(context: vscode.ExtensionContext) {
  const build = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  build.name = 'HARDWARIO: Toolbar';
  build.text = '$(check)';
  build.tooltip = 'HARDWARIO: Build Firmware';
  build.command = 'hardwario-tower.build';
  build.show();
  context.subscriptions.push(build);

  const flash = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  flash.name = 'HARDWARIO: Toolbar';
  flash.text = '$(arrow-up)';
  flash.tooltip = 'HARDWARIO: Flash Firmware';
  flash.command = 'hardwario-tower.flash';
  flash.show();
  context.subscriptions.push(flash);

  const console = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  console.name = 'HARDWARIO: Toolbar';
  console.text = '$(debug-alt)';
  console.tooltip = 'HARDWARIO: Build + Flash (Console)';
  console.command = 'hardwario-tower.flash_and_log';
  console.show();
  context.subscriptions.push(console);

  const clean = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  clean.name = 'HARDWARIO: Toolbar';
  clean.text = '$(notebook-delete-cell)';
  clean.tooltip = 'HARDWARIO: Clean All Outputs';
  clean.command = 'hardwario-tower.clean';
  clean.show();
  context.subscriptions.push(clean);

  releaseBar = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  releaseBar.name = 'HARDWARIO: Toolbar';
  releaseBar.text = `Firmware type: ${releaseType}`;
  releaseBar.tooltip = 'HARDWARIO: Change release type';
  releaseBar.command = 'hardwario-tower.change_release_type';
  releaseBar.show();
  context.subscriptions.push(releaseBar);
}

/**
 * Setup the rest of the extension (not based on portable version)
 */
function setup() {
  createToolbar(contextGlobal);

  pushGeneralCommands();
  pushHardwarioCommands();

  helpers.addSetting();

  vscode.window.registerTreeDataProvider('palette', new PaletteProvider());
  // vscode.window.showInformationMessage('Setup done, you can use HARDWARIO Extension');
}

/**
 * Sets up the extension in full if the VSCode is not portable
 */
function setupNormal() {
  if (helpers.WINDOWS) {
    helpers.checkCommand('git', 'Please install git, add it to PATH and restart VSCode', 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    helpers.checkCommand('make', 'Please install make, add it to PATH and restart VSCode', 'How to install make', 'Cancel', 'https://www.technewstoday.com/install-and-use-make-in-windows/');
    helpers.checkCommand('arm-none-eabi-gcc', 'Please install arm-none-eabi-gcc, add it to PATH and restart VSCode', 'How to install arm-none-eabi-gcc', 'Cancel', 'https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-windows');
    helpers.checkCommand('rm', 'Please install linux commands, add them to PATH and restart VSCode', 'How to install linux tools', 'Cancel', 'https://github.com/git-guides/install-git#install-git-on-linux');
    helpers.checkCommand('bcf', 'Please install bcf, add if to PATH and restart VSCode', 'How to install bcf', 'Cancel', 'https://tower.hardwario.com/en/latest/tools/hardwario-firmware-flashing-tool/#install-upgrade');
    helpers.checkCommand('cmake', 'Please install CMake, add if to PATH and restart VSCode', 'How to install CMake', 'Cancel', 'https://cmake.org/install/');
    helpers.checkCommand('ninja', 'Please install Ninja, add if to PATH and restart VSCode', 'How to install Ninja', 'Cancel', 'https://github.com/ninja-build/ninja/releases');

    if (!commandExistsSync('python') && !commandExistsSync('python3')) {
      vscode.window.showWarningMessage(
        'Please install python, add it to PATH and restart VSCode',
        'How to install python',

        'Cancel',
      )
        .then((answer) => {
          if (answer === 'How to install python') {
            vscode.env.openExternal(vscode.Uri.parse('https://phoenixnap.com/kb/how-to-install-python-3-windows'));
          }
        });
    }
    buildTerminal.get().sendText('python -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('python3 -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('exit 0');
  } else if (helpers.LINUX) {
    helpers.checkCommand('git', 'Please install git and restart VSCode', 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    helpers.checkCommand('make', 'Please install make and restart VSCode', 'How to install make', 'Cancel', 'https://linuxhint.com/install-make-ubuntu/');
    helpers.checkCommand('arm-none-eabi-gcc', 'Please install arm-none-eabi-gcc and restart VSCode', 'How to install arm-none-eabi-gcc', 'Cancel', 'https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-linux');
    helpers.checkCommand('bcf', 'Please install bcf and restart VSCode', 'How to install bcf', 'Cancel', 'https://tower.hardwario.com/en/latest/tools/hardwario-firmware-flashing-tool/#install-upgrade');
    helpers.checkCommand('cmake', 'Please install CMake, add if to PATH and restart VSCode', 'How to install CMake', 'Cancel', 'https://cmake.org/install/');
    helpers.checkCommand('ninja', 'Please install Ninja, add if to PATH and restart VSCode', 'How to install Ninja', 'Cancel', 'https://github.com/ninja-build/ninja/releases');

    if (!commandExistsSync('python') && !commandExistsSync('python3')) {
      vscode.window.showWarningMessage(
        'Please install python, add it to PATH and restart VSCode',
        'How to install python',

        'Cancel',
      )
        .then((answer) => {
          if (answer === 'How to install python') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.scaler.com/topics/python/install-python-on-linux/'));
          }
        });
    }
    buildTerminal.get().sendText('python -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('python3 -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('exit 0');
  } else if (helpers.MACOS) {
    helpers.checkCommand('git', 'Please install git and restart VSCode', 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    helpers.checkCommand('make', 'Please install make and restart VSCode', 'How to install make', 'Cancel', 'https://formulae.brew.sh/formula/make');
    helpers.checkCommand('arm-none-eabi-gcc', 'Please install arm-none-eabi-gcc and restart VSCode', 'How to install arm-none-eabi-gcc', 'Cancel', 'https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-mac-os-x');
    helpers.checkCommand('bcf', 'Please install bcf and restart VSCode', 'How to install bcf', 'Cancel', 'https://tower.hardwario.com/en/latest/tools/hardwario-firmware-flashing-tool/#install-upgrade');
    helpers.checkCommand('cmake', 'Please install CMake, add if to PATH and restart VSCode', 'How to install CMake', 'Cancel', 'https://cmake.org/install/');
    helpers.checkCommand('ninja', 'Please install Ninja, add if to PATH and restart VSCode', 'How to install Ninja', 'Cancel', 'https://github.com/ninja-build/ninja/releases');

    if (!commandExistsSync('python') && !commandExistsSync('python3')) {
      vscode.window.showWarningMessage(
        'Please install python, add it to PATH and restart VSCode',
        'How to install python',

        'Cancel',
      )
        .then((answer) => {
          if (answer === 'How to install python') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.dataquest.io/blog/installing-python-on-mac/'));
          }
        });
    }
    buildTerminal.get().sendText('python -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('python3 -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('exit 0');
  }
  setup();
}

/**
 * Sets up the extension in full if the VSCode is portable
 */
function setupPortable() {
  if (helpers.WINDOWS) {
    buildTerminal.get().sendText('python -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('python3 -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('exit 0');
  } else if (helpers.MACOS) {
    buildTerminal.get().sendText('python -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('python3 -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('exit 0');
  } else if (helpers.LINUX) {
    helpers.checkCommand('git', "Please install git with 'sudo apt install git' and restart VSCode", 'How to install git', 'Cancel', 'https://github.com/git-guides/install-git#install-git-on-linux');
    buildTerminal.get().sendText('python -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('python3 -m pip install --upgrade --force-reinstall --user bcf');
    buildTerminal.get().sendText('exit 0');
  }

  setup();
}

/**
 * Activation function that fires at the start of VSCode
 * Takes care of setting up the command palette and all of the commands
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
  contextGlobal = context;

  vscode.window.onDidCloseTerminal((terminal) => {
    if (buildTerminal.instance !== null && terminal === buildTerminal.get()) {
      if (preDebugBuildActive) {
        preDebugBuildActive = false;
        helpers.startDebug();
      }
      buildTerminal.instance = null;
    } else if (flashTerminal.instance !== null && terminal === flashTerminal.get()) {
      flashTerminal.instance = null;
    } else if (consoleTerminal.instance !== null && terminal === consoleTerminal.get()) {
      consoleTerminal.instance = null;
    } else if (cleanTerminal.instance !== null && terminal === cleanTerminal.get()) {
      cleanTerminal.instance = null;
    } else if (flashAndLogTerminal.instance !== null && terminal === flashAndLogTerminal.get()) {
      flashAndLogTerminal.instance = null;
    } else if (cloneTerminal.instance !== null && terminal === cloneTerminal.get()) {
      if (lastSelectedFolder !== '') {
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(lastSelectedFolder));
        lastSelectedFolder = '';
      }
    }
  });

  /**
   * If the open folder is HARDWARIO TOWER firmware the extension will be started in full
   */
  if (helpers.isHardwarioProject()) {
    /**
    * Looks for the HARDWARIO TOWER devices connected to the computer by a serial port
    * Every 2 seconds
    */
    setInterval(() => {
      SerialPort.list().then((ports) => {
        let index = 0;
        const portsLen = ports.length;
        for (let i = 0; i < portsLen; i += 1) {
          if (ports[index].serialNumber === undefined || (!ports[index].serialNumber.includes('usb-dongle') && !ports[index].serialNumber.includes('core-module'))) {
            ports.splice(index, 1);
          } else {
            index += 1;
          }
        }
        if (JSON.stringify(ports) === JSON.stringify(serialPorts)) {
          return;
        }
        serialPorts = ports;
        if (portSelection !== null) {
          portSelection.dispose();
          portSelection = null;
        }

        if (portSelection === null) {
          if (deviceIndex >= serialPorts.length) {
            deviceIndex = serialPorts.length - 1;
          }

          if (ports.length !== 0) {
            selectedPort = ports[deviceIndex].path;
          } else {
            selectedPort = '';
            deviceIndex = 0;
          }
          portSelection = vscode.window.createStatusBarItem(
            'toolbar',
            vscode.StatusBarAlignment.Left,
            1,
          );

          portSelection.name = 'HARDWARIO: Toolbar';

          if (ports.length === 0) {
            portSelection.text = 'No device found!';
          } else {
            portSelection.text = `Device: ${ports[deviceIndex].path} - ${ports[deviceIndex].serialNumber.split('-').slice(0, 3).join('-')}`;
          }
          portSelection.tooltip = 'HARDWARIO: Change device';
          portSelection.command = 'hardwario-tower.change_device';
          portSelection.show();
          context.subscriptions.push(portSelection);
        }
      });
    }, 2000);

    /**
    * Selects how to setup the extension based on the type of VSCode
    */
    if (helpers.isPortable()) {
      setupPortable();
    } else {
      setupNormal();
    }
    helpers.checkProjectStructure(contextGlobal);

    const provider = new HardwarioTowerDebugConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('hardwario-debugger', provider));
  }

  /**
   * If the open folder is not HARDWARIO TOWER firmware
   * the extension will be initialized in a limited mode
   */
  else {
    pushGeneralCommands();
    vscode.window.registerTreeDataProvider('palette', new PaletteProvider());
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}

/**
 * Debug configuration with HARDWARIO TOWER Debug name
 * Calls preDebugBuild function if no launch.json is present
 */
class HardwarioTowerDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(_folder: vscode.WorkspaceFolder |
    undefined, config: vscode.DebugConfiguration):vscode.ProviderResult<vscode.DebugConfiguration> {
    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'c' && helpers.isHardwarioProject()) {
        preDebugBuild();
        preDebugBuildActive = true;
      }
    }
    return undefined;
  }
}
