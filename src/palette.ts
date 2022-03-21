import * as vscode from 'vscode';

export class PaletteProvider implements vscode.TreeDataProvider<PaletteCommand>  {


	getTreeItem(element: PaletteCommand): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PaletteCommand) {
		return [
            new PaletteCommand('Build firmware', 'hardwario-tower.build'),
            new PaletteCommand('Flash firmware', 'hardwario-tower.flash'),
			new PaletteCommand('Upload and Log', 'hardwario-tower.flashAndLog'),
            new PaletteCommand('Open console', 'hardwario-tower.console'),
            new PaletteCommand('Clean output', 'hardwario-tower.clean')
        ];
	}
}

export class PaletteCommand extends vscode.TreeItem {

	constructor(
		public readonly  label: string,
		public command?,
	) {
		super(label);

		if(command)
        {
            this.command = {
                title: label,
                command
            };
        }
	}
}