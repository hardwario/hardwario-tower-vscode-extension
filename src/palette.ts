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
          new PaletteCommand('From Skeleton Project...', undefined, 'hardwario.tower.cloneSkeleton'),
          new PaletteCommand('From Existing Project...', undefined, 'hardwario.tower.cloneFirmware'),
        ]),
        new PaletteCommand('TOWER: Commands', [
          new PaletteCommand('Build + Flash (Console)', undefined, 'hardwario.tower.flashAndLog'),
          new PaletteCommand('Build + Flash (Debugger)', undefined, 'hardwario.tower.flashAndDebug'),

          new PaletteCommand('Clean All Outputs', undefined, 'hardwario.tower.clean'),
          new PaletteCommand('Build Firmware', undefined, 'hardwario.tower.build'),
          new PaletteCommand('Flash Firmware', undefined, 'hardwario.tower.flashToDevice'),

          new PaletteCommand('Attach Console', undefined, 'hardwario.tower.console'),
          new PaletteCommand('Attach Debugger', undefined, 'hardwario.tower.debug'),
        ]),
        new PaletteCommand('TOWER: Maintenace', [
          new PaletteCommand('Update Firmware SDK', undefined, 'hardwario.tower.updateSdk'),
          new PaletteCommand('Upgrade Firmware Project', undefined, 'hardwario.tower.upgradeFirmware'),
        ]),
        new PaletteCommand('TOWER: Resources', [
          new PaletteCommand('Technical Documentation', undefined, 'hardwario.tower.openDocumentation'),
          new PaletteCommand('Software Development Kit', undefined, 'hardwario.tower.openSdk'),
          new PaletteCommand('Projects on Hackster.io', undefined, 'hardwario.tower.openProjects'),
          new PaletteCommand('GitHub Repositories', undefined, 'hardwario.tower.openGithub'),
          new PaletteCommand('Discussion Forum', undefined, 'hardwario.tower.openForum'),
        ]),
        new PaletteCommand('Company Links', [
          new PaletteCommand('TOWER: Website', undefined, 'hardwario.tower.openWebsite'),
          new PaletteCommand('TOWER: E-shop', undefined, 'hardwario.tower.openShop'),
        ]),
      ];
    } else {
      this.data = [
        new PaletteCommand('Start New TOWER Firmware', [
          new PaletteCommand('From Skeleton Project...', undefined, 'hardwario.tower.cloneSkeleton'),
          new PaletteCommand('From Existing Project...', undefined, 'hardwario.tower.cloneFirmware'),
        ]),
        new PaletteCommand('TOWER Resources', [
          new PaletteCommand('Technical Documentation', undefined, 'hardwario.tower.openDocumentation'),
          new PaletteCommand('Software Development Kit', undefined, 'hardwario.tower.openSdk'),
          new PaletteCommand('Projects on Hackster.io', undefined, 'hardwario.tower.openProjects'),
          new PaletteCommand('GitHub Repositories', undefined, 'hardwario.tower.openGithub'),
          new PaletteCommand('Discussion Forum', undefined, 'hardwario.tower.openForum'),
        ]),
        new PaletteCommand('Other Resources', [
          new PaletteCommand('TOWER: Website', undefined, 'hardwario.tower.openWebsite'),
          new PaletteCommand('TOWER: E-shop', undefined, 'hardwario.tower.openShop'),
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
