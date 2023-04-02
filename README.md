# vcpkg CMake Tools

[Vcpkg VSCode CMake extension](https://marketplace.visualstudio.com/items?itemName=JackBoosY.vcpkg-cmake-tools) provides vcpkg integration in VSCode.

It's still WIP, please help us to improve it in [github](https://github.com/JackBoosY/vcpkg-vscode-extension).

## Requirements

- VSCode >= 1.76.0
- CMake Tools extension >= 1.13.0

## Usage

### Enable vcpkg integration

1. Ctrl(⌘) + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Enable vcpkg`:

  a. Extension will automaticly enable vcpkg if you already set environment variable `VCPKG_ROOT` or already set vcpkg path in settings.
  
  b. If environment variable `VCPKG_ROOT` is not set, please choose vcpkg root folder.

4. Extension will select the triplet (dynamic) according to your system architecture, vcpkg toolchain will be added into cmake settings.

### Disable vcpkg integration

1. Ctrl(⌘) + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Disable vcpkg`.
4. vcpkg toolchain will be removed from cmake toolchain and other vcpkg setting will also be removed from cmake options.

### Use static library

1. Ctrl(⌘) + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Use static library`.

### Use dynamic library

1. Ctrl(⌘) + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Use dynamic library`.

### Set vcpkg additional install options

1. Open `Settings` - `Extensions`(in `workspace`) - `Vcpkg`.
2. Add additional options one by one in `Vcpkg › Target: Additional Options`.

## Release Notes

### 0.2.2

- Manifest mode only can be enabled when vcpkg is enabled.

### 0.2.1

- Add CRT Linkage option

### 0.1.3

- Now all settings will be synced in workspace settings
- Vcpkg path can be set only once on the same machine

### 0.1.2

- Fix target triplet can't be syncd when using dynamic lib

### 0.1.1

- Fix vcpkg path is invalid on non-Windows
- Add guide for VCPKG_INSTALL_OPTIONS

### 0.1.0

- Support non-Windows
- Fix the problem of changing settings without responding

### 0.0.4

- Support VCPKG_INSTALL_OPTIONS

### 0.0.3

- Update document.

### 0.0.2

- Update logo

### 0.0.1

- Add feature to enable/disable vcpkg.
- Add feature to use dynamic/static triplet/library.