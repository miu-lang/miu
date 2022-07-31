# Developing Miu

Clone with `git clone https://github.com/miu-lang/miu.git`.

## Installing dependencies

There are two ways to install development dependencies:
1. Using ASDF + some manual steps: Recommended if you're unfamiliar with Nix.
2. Using Nix.

### Installing dependencies semi-manually with ASDF

1. Install a C++ toolchain (recommended: clang-14).
   - Ubuntu: `sudo apt install clang-14`
   - macOS: `brew install llvm@14`
2. Install [asdf](https://asdf-vm.com/guide/getting-started.html#_2-download-asdf) and [direnv](https://direnv.net/docs/installation.html).
3. Set up asdf, tools and direnv.
   ```
   asdf plugin add rust && asdf plugin add bazel && asdf plugin add direnv

   # Ignore any comments about adding things to your PATH
   asdf install

   asdf direnv setup --shell $SHELL --version system
   ```

### Installing dependencies via Nix

```
nix develop
```

## Building

Without Nix, build using:

```
bazel build //...
```

With Nix, build using:

```
nix build
```

## Updating dependencies

After updating the appropriate `Cargo.toml`, re-run:

```
CARGO_BAZEL_REPIN=1 bazel sync --only=crates_io_index
```

Otherwise, you'll get a build error, which looks like:

```
error: the lock file /path/to/Cargo.lock needs to be updated but --locked was passed to prevent this
If you want to try to generate the lock file without accessing the network, remove the --locked flag and use --offline instead.
```
