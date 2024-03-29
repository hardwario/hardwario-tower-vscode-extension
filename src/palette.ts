/* eslint-disable class-methods-use-this */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import * as vscode from 'vscode';
import * as helpers from './helpers';
import PaletteCommand from './paletteCommand';

/**
 * Class for the command palette provided to the user
 */
class PaletteProvider implements vscode.TreeDataProvider<PaletteCommand> {
  data: PaletteCommand[];

  constructor() {
    /**
    * If open folder is a HARDWARIO TOWER firmware provide all the options,
    * otherwise provide just the basic options
    */
    if (helpers.isHardwarioProject()) {
      this.data = [
        new PaletteCommand('TOWER: Start', [
          new PaletteCommand('From Skeleton Project...', undefined, 'hardwario.tower.cloneSkeleton', 'github.svg'),
          new PaletteCommand('From Existing Project...', undefined, 'hardwario.tower.cloneFirmware', 'github.svg'),
        ]),
        new PaletteCommand('TOWER: Commands', [
          new PaletteCommand('Build + Flash (Console)', undefined, 'hardwario.tower.flashAndLog', 'flashAndAttach.svg'),
          new PaletteCommand('Build + Flash (Debugger)', undefined, 'hardwario.tower.flashAndDebug', 'debug.svg'),

          new PaletteCommand('Clean All Outputs', undefined, 'hardwario.tower.clean', 'trash.svg'),
          new PaletteCommand('Build Firmware', undefined, 'hardwario.tower.build', 'tick.svg'),
          new PaletteCommand('Flash Firmware', undefined, 'hardwario.tower.flashToDevice', 'up.svg'),

          new PaletteCommand('Attach Console', undefined, 'hardwario.tower.console', 'attach.svg'),
          new PaletteCommand('Attach Debugger', undefined, 'hardwario.tower.debug', 'debug.svg'),
        ]),
        new PaletteCommand('TOWER: Maintenace', [
          new PaletteCommand('Update Firmware SDK', undefined, 'hardwario.tower.updateSdk', 'update.svg'),
          new PaletteCommand('Upgrade Firmware Project', undefined, 'hardwario.tower.upgradeFirmware', 'update.svg'),
        ]),
        new PaletteCommand('TOWER: Resources', [
          new PaletteCommand('Product Website', undefined, 'hardwario.tower.openWebsite', 'web.svg'),
          new PaletteCommand('Technical Documentation', undefined, 'hardwario.tower.openDocumentation', 'documentation.svg'),
          new PaletteCommand('Software Development Kit', undefined, 'hardwario.tower.openSdk', 'sdk.svg'),
          new PaletteCommand('Projects on Hackster.io', undefined, 'hardwario.tower.openProjects', 'projects.svg'),
          new PaletteCommand('GitHub Repositories', undefined, 'hardwario.tower.openGithub', 'github.svg'),
          new PaletteCommand('Discussion Forum', undefined, 'hardwario.tower.openForum', 'forum.svg'),
          new PaletteCommand('Online shop', undefined, 'hardwario.tower.openShop', 'cart.svg'),
        ]),
      ];
    } else {
      this.data = [
        new PaletteCommand('TOWER: Start', [
          new PaletteCommand('From Skeleton Project...', undefined, 'hardwario.tower.cloneSkeleton', 'github.svg'),
          new PaletteCommand('From Existing Project...', undefined, 'hardwario.tower.cloneFirmware', 'github.svg'),
        ]),
        new PaletteCommand('TOWER: Resources', [
          new PaletteCommand('Product Website', undefined, 'hardwario.tower.openWebsite', 'web.svg'),
          new PaletteCommand('Technical Documentation', undefined, 'hardwario.tower.openDocumentation', 'documentation.svg'),
          new PaletteCommand('Software Development Kit', undefined, 'hardwario.tower.openSdk', 'sdk.svg'),
          new PaletteCommand('Projects on Hackster.io', undefined, 'hardwario.tower.openProjects', 'projects.svg'),
          new PaletteCommand('GitHub Repositories', undefined, 'hardwario.tower.openGithub', 'github.svg'),
          new PaletteCommand('Discussion Forum', undefined, 'hardwario.tower.openForum', 'forum.svg'),
          new PaletteCommand('Online shop', undefined, 'hardwario.tower.openShop', 'cart.svg'),
        ]),
      ];
    }
  }

  getTreeItem(element: PaletteCommand): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PaletteCommand|undefined): vscode.ProviderResult<PaletteCommand[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }
}

export default PaletteProvider;
