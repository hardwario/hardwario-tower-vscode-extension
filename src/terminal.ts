import * as vscode from 'vscode';
import * as path from 'path';

export class Terminal
{
    _instance: any;
    constructor() {
        this._instance = null;
    }

    get()
    {
        if(this._instance === null)
        {
            let vscodepath = process.env.VSCODE_CWD
            let towerPath = path.join(vscodepath, 'data', 'tower');

            let pythonPath = path.join(towerPath, 'python');
            let pythonScriptsPath = path.join(pythonPath, 'Scripts');
            let toolchainPath = path.join(towerPath, 'toolchain');
            
            let makeBinPath = path.join(toolchainPath, 'make', 'bin');
            
            let gccPath = path.join(toolchainPath, 'gcc');
            let gccBinPath = path.join(gccPath, 'bin');
            let gccArmBinPath = path.join(gccPath, 'arm-none-eabi', 'bin');

            let gitPath = path.join(toolchainPath, 'git');
            let gitCmdPath = path.join(gitPath, 'cmd');
            let gitUsrBinPath = path.join(gitPath, 'usr', 'bin');
            let gitMingw64BinPath = path.join(gitPath, 'mingw64', 'bin');

            const envClone = Object.create(process.env);
            
            envClone.PATH = pythonPath + ';' + pythonScriptsPath + ';' + makeBinPath + ';' + gccBinPath + ';' + gccArmBinPath + ';' + gitCmdPath + ';' + gitUsrBinPath + ';' + gitMingw64BinPath;
            envClone.Path = pythonPath + ';' + pythonScriptsPath + ';' + makeBinPath + ';' + gccBinPath + ';' + gccArmBinPath + ';' + gitCmdPath + ';' + gitUsrBinPath + ';' + gitMingw64BinPath;
            //envClone.PATH = "C:\\Users\\Kubaa\\.hardwario\\tower\\python;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\make\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\gcc\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\gcc\\arm-none-eabi\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\usr\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\mingw64\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\cmd";
            //envClone.Path = "C:\\Users\\Kubaa\\.hardwario\\tower\\python;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\make\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\gcc\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\gcc\\arm-none-eabi\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\usr\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\mingw64\\bin;C:\\Users\\Kubaa\\.hardwario\\tower\\toolchain\\git\\cmd";
            this._instance = vscode.window.createTerminal({
                name: 'HARDWARIO TOWER',
                env: envClone,
              });
            return this._instance;
        }
        else
        {
            return this._instance;
        }
    }
}