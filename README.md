# HARDWARIO TOWER VS Code extension - BETA

[![License](https://img.shields.io/github/license/bigclownprojects/bcf-lora-climate-pir-co2.svg)](https://github.com/bigclownprojects/bcf-lora-climate-pir-co2/blob/master/LICENSE)
[![Twitter](https://img.shields.io/twitter/follow/hardwario_en.svg?style=social&label=Follow)](https://twitter.com/hardwario_en)

Extension for Visual Studio Code made to help with firmware developement

## Features

This extension takes care of building, flashing and console logging of your firmware. You can also clone firmware from GitHub so you don't have to start developement from scratch.

This extension also autodetects any connected HARDWARIO TOWER devices that you can roll through and work with them.

To work with the extension you can use the bottom bar of the VS Code or open the command palette on the left side bar.

## Requirements
### Portable version
You can download Portable Visual Studio Code version that contains all the dependencies. And will work right after download.

**TODO LINK TO DOWNLOAD THE PORTABLE VERSION**

### Normal Visual Studio Code
If you want to put this extension into your already installed version of Visual Studio Code you will have to install all dependencies and put them into the PATH. The extension will warn you about everything you are missing at the start. If you see no warning you are good to go.

To add this extension into your list of extensions, go to the extensions folder and clone this repository into it.

Extensions folder is most likely located based on your system:
- **Windows** - `%USERPROFILE%\.vscode\extensions`
- **Linux** - `~/.vscode/extensions`
- **macOS** - `~/.vscode/extensions`

Go to the respective folder and put clone with this command:
````
git clone https://github.com/hardwario/hardwario-tower-vscode-extension.git hardwario-code
````

#### Extension dependencies:
- **make** - for compiling the firmware - TODO LINK
- **python** - our flashing and logging tool is made in python - TODO LINK
- **bcf** - our flashing and logging tool made in python - TODO LINK
- **arm-none-eabi-gcc** - TODO LINK
- **git** - for cloning submodules and firmwares - TODO LINK
- **Linux commands** - you will need commands like **rm** **mkdir** - TODO LINK

## Known Issues

Right now the J-Link debug works only on the portable Windows version.

## Release Notes

This is a beta version of the extension

-----------------------------------------------------------------------------------------------------------

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT/) - see the [LICENSE](LICENSE) file for details.

---

Made with &#x2764;&nbsp; by [**HARDWARIO s.r.o.**](https://www.hardwario.com/) in the heart of Europe.