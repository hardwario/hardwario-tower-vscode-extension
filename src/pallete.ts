import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class PalleteProvider implements vscode.TreeDataProvider<PalleteCommand>  {


	getTreeItem(element: PalleteCommand): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PalleteCommand) {
		return [
            new PalleteCommand('Compile', 'hardwario-tower.compile'),
            new PalleteCommand('Upload', 'hardwario-tower.upload'),
            new PalleteCommand('Log', 'hardwario-tower.log'),
            new PalleteCommand('Clear', 'hardwario-tower.clear')
        ];
	}
}

export class PalleteCommand extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public readonly command?
	) {
		super(label);

		if(command)
        {
            this.command = {
                title: label,
                command
            }
        }
	}
}