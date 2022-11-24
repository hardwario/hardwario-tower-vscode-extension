# HARDWARIO TOWER VS Code extension

[![License](https://img.shields.io/github/license/bigclownprojects/bcf-lora-climate-pir-co2.svg)](https://github.com/bigclownprojects/bcf-lora-climate-pir-co2/blob/master/LICENSE)
[![Twitter](https://img.shields.io/twitter/follow/hardwario_en.svg?style=social&label=Follow)](https://twitter.com/hardwario_en)

Extension for Visual Studio Code made to help with firmware development

## Features

This extension takes care of building, flashing and console logging of your firmware. You can also clone firmware from GitHub so you don't have to start development from scratch.

This extension also autodetect any connected HARDWARIO TOWER devices that you can roll through and work with them.

To work with the extension you can use the bottom bar of the VS Code or open the command palette on the left sidebar.

## Requirements
### Portable version
You can download the [Portable Visual Studio Code](https://drive.google.com/drive/u/3/folders/1gC91vzSR0O1RONRX6LMJ8_ug1_UOikpt) version that contains all the dependencies. And will work right after download.

You can learn more about the HARDWARIO Code in the [About HARDWARIO Code documentation chapter](https://docs.hardwario.com/tower/firmware-development/about-hardwario-code).

### Normal Visual Studio Code
If you want to put this extension into your already installed version of Visual Studio Code you will have to install all dependencies and put them into the PATH. The extension will warn you about everything you are missing at the start. If you see no warning you are good to go.

You can learn more about the extension in the [TOWER VSCode Extension documentation chapter](https://docs.hardwario.com/tower/firmware-development/tower-vscode-extension).

To install the extension, [download *.vsix from releases](https://github.com/hardwario/hardwario-tower-vscode-extension/releases), open your Visual Studio Code and go to `Extensions->...->Install from v VSIX...` and select the downloaded *.vsix

![alt How to install extension](/media/InstallGuide.png "How to install extension").

#### Extension dependencies:
- **cmake**
    - [Install cmake](https://cmake.org/install/)
- **ninja**
    - [Install ninja](https://github.com/ninja-build/ninja/releases)
- **arm-none-eabi-gcc**
    - [Install Windows](https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-windows)
    - [Install Linux](https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-linux)
    - [Install macOS](https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-mac-os-x)
- **git** - for cloning submodules and firmware
    - [Install git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- **Linux commands** - you will need commands like **rm** **mkdir**
    - *This is Windows only*
    - You have to install git to your machine and then add the ``\usr\bin\`` folder to PATH. The folder path should look something like ``C:\Program Files\Git\usr\bin\``

## Known Issues

## Release Notes

-----------------------------------------------------------------------------------------------------------

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT/) - see the [LICENSE](LICENSE) file for details.

---

Made with &#x2764;&nbsp; by [**HARDWARIO a.s.**](https://www.hardwario.com/) in the heart of Europe.