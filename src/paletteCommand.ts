/* eslint-disable import/no-unresolved */
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Class constructing palette commands
 */
class PaletteCommand extends vscode.TreeItem {
  // eslint-disable-next-line no-use-before-define
  children?: PaletteCommand[]|undefined;

  command?: vscode.Command|undefined;

  constructor(
        public readonly label: string,
        children?: PaletteCommand[],
        command?,
        iconPath?,
  ) {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded,
    );

    if (command) {
      this.command = {
        title: label,
        command,
      };
    }
    this.children = children;
    if (iconPath) {
      this.iconPath = {
        light: path.join(__filename, '..', '..', 'media', 'icons', 'light', iconPath),
        dark: path.join(__filename, '..', '..', 'media', 'icons', 'dark', iconPath),
      };
    }
  }
}

export default PaletteCommand;
