import * as vscode from 'vscode';

export class PaletteProvider implements vscode.TreeDataProvider<PaletteCommand>  {

	onDidChangeTreeData?: vscode.Event<PaletteCommand|null|undefined>|undefined;

	data: PaletteCommand[];

	constructor() {
		this.data = [
			new PaletteCommand('Commands', [
				new PaletteCommand('Build firmware', undefined, 'hardwario-tower.build'),
				new PaletteCommand('Flash firmware', undefined, 'hardwario-tower.flash'),
				new PaletteCommand('Flash and Log', undefined, 'hardwario-tower.flash_and_log'),
				new PaletteCommand('Open console', undefined, 'hardwario-tower.console'),
				new PaletteCommand('Clean output', undefined, 'hardwario-tower.clean'),
			]),
			new PaletteCommand('Firmware', [
				new PaletteCommand('New empty firmware', undefined, 'hardwario-tower.clone_skeleton'),
				new PaletteCommand('New firmware from template', undefined, 'hardwario-tower.clone_firmware')
			]),
			new PaletteCommand('Other', [
				new PaletteCommand('Documentation', undefined, 'hardwario-tower.open_documentation'),
				new PaletteCommand('Projects', undefined, 'hardwario-tower.open_projects'),
				new PaletteCommand('GitHub', undefined, 'hardwario-tower.open_github'),
				new PaletteCommand('Forum', undefined, 'hardwario-tower.open_forum'),
				new PaletteCommand('Shop', undefined, 'hardwario-tower.open_shop'),
			])
        ];
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

export class PaletteCommand extends vscode.TreeItem {
	children?: PaletteCommand[]|undefined;
	command?: vscode.Command|undefined;

	constructor(
		public readonly  label: string,
		children?: PaletteCommand[],
		command?,
	) {
		super(
			label,
			children === undefined ? vscode.TreeItemCollapsibleState.None :
									 vscode.TreeItemCollapsibleState.Expanded);

		if(command)
        {
            this.command = {
                title: label,
                command
            };
        }
		this.children = children;
	}
}