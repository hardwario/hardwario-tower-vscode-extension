/* eslint-disable import/no-unresolved */
import * as vscode from 'vscode';

/**
 * Class constructing palette commands
 */
class PaletteCommand extends vscode.TreeItem {
  children?: PaletteCommand[]|undefined;

  command?: vscode.Command|undefined;

  constructor(
        public readonly label: string,
        children?: PaletteCommand[],
        command?,
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
  }
}

export default PaletteCommand;
