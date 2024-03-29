# vcpkg CMake Tools

[Vcpkg VSCode CMake extension](https://marketplace.visualstudio.com/items?itemName=JackBoosY.vcpkg-cmake-tools) provides vcpkg integration in VSCode.

Please report any bugs in [github](https://github.com/JackBoosY/vcpkg-vscode-extension).

## Requirements

- VSCode >= 1.76.0
- CMake Tools extension >= 1.13.0

## Usage

You can use Vcpkg getting start page to control vcpkg behavior.

for more options, please see `Preferences` - `Settings` - `Extensions` - `vcpkg`.

![getting-start-page](./media/intro.png)

Also, you can manually control vcpkg behavior with the following commands:

### Enable vcpkg integration

1. Ctrl(⌘) + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Enable vcpkg`:

  a. Extension will automaticly enable vcpkg if you already set environment variable `VCPKG_ROOT` or already set vcpkg path in settings.

  b. Extension will automaticly enable vcpkg if vcpkg root folder was selected before.

  c. Otherwise, please choose vcpkg root folder.

4. Extension will select the triplet (dynamic) according to your system architecture, vcpkg toolchain will be added into cmake settings.

You can also enable/disable vcpkg in `Preferences` - `Settings` - `Extensions`(in `workspace`) - `Vcpkg`.

Note: please only enable/disable in `workspace`!

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

### Set target triplet

1. Ctrl(⌘) + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Set target triplet`.
4. Enter your target triplet

### Set host triplet

1. Ctrl(⌘) + Shift + P
2. Search vcpkg.
3. Select `vcpkg: Set host triplet`.
4. Enter your host triplet

### Enable/Disable automatically update host/target triplet

1. Open `Preferences` - `Settings` - `Extensions`(in `workspace`) - `Vcpkg`.
2. Select/Unselect `Vcpkg › General: Auto Update Triplet`.

### Set vcpkg additional install options

1. Open `Preferences` - `Settings` - `Extensions`(in `workspace`) - `Vcpkg`.
2. Add additional options one by one in `Vcpkg › Target: Additional Options`.

### Enable/Disable install dependency binaries

1. Open `Preferences` - `Settings` - `Extensions`(in `workspace`) - `Vcpkg`.
2. Select/Unselect `Vcpkg › Target: Install Dependencies`.

### Find system/vcpkg installed libraries first

1. Open `Preferences` - `Settings` - `Extensions`(in `workspace`) - `Vcpkg`.
2. Select/Unselect `Vcpkg › Target: Prefer System Libs`.

### Version and builtin-baseline autocompletion in vcpkg manifest

1. Enable vcpkg integration.
2. Set vcpkg path.
3. Autocompletion will be enabled automatically when typing `"`.

### Debug portfile or other vcpkg provided cmake code

1. Set breakpoint in the portfile.cmake (required) or other cmake file.
2. Open `Run and Debug` in left side bar, select `Debug portfile(s)`, click the green triangle to run debugging.

### Debug port's CMake code

1. Set breakpoint in the portfile.cmake.
2. Run install command with `--editable`(important!) then set breakpoint in source cmake file(folder name without `.clean`).
3. Open `Run and Debug` in left side bar, select `Debug portfile(s)`, click the green triangle to run debugging.