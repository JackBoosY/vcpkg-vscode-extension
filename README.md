# vcpkg-tools README

Vcpkg VSCode CMake extension.

## Usage

### Enable vcpkg integration

1. Ctrl + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Enable vcpkg`.
  a. Extension will automaticly enable vcpkg if you already set environment variable `VCPKG_ROOT` or already set vcpkg path in settings.
  b. If environment variable `VCPKG_ROOT` is not set, please choose vcpkg root folder.
4. Extension will select the triplet (dynamic) according to your system architecture, vcpkg toolchain will be added into cmake settings.

### Disable vcpkg integration

1. Ctrl + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Disable vcpkg`.
4. vcpkg toolchain will be removed from cmake toolchain and other vcpkg setting will also be removed from cmake options.

### Use static library

1. Ctrl + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Use static library`.

### Use dynamic library

1. Ctrl + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Use dynamic library`.


## Requirements

- VSCode >= 1.76.0
- CMake Tools extension >= 1.13.0

## Known Issue

## Release Notes

Users appreciate release notes as you update your extension.

### 0.0.2

- Update logo

### 0.0.1

- Add feature to enable/disable vcpkg.
- Add feature to use dynamic/static triplet/library.