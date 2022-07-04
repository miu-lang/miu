# Development Log

## July 4 2022

### Rust interop

- Added some initial notes on [Rust interop](./RustInterop.md),
  and a [bibliography](./Bibliography.md).

### Parser

- Started migrating tree-sitter grammar from an older prototype.
  Right now, it has a LOT of constructs; I'm wondering if it
  makes sense to start from scratch.
  The grammar isn't really the "hard" part,
  there are many bigger problems to tackle
  (e.g. easy Rust interop, scoping out type-checking work etc.)

### Editor integration

- Thorsten had pointed out on Twitter how easy it was to use
  nvim-treesitter to get syntax highlighting in Neovim.
  I explored this and it "works",
  except that I couldn't get the filetype detection working
  for some reason. 😐
- Sublime's APIs around `Phantom`s haven't changed much
  from the last time I checked, which do not allow selecting text.
- I was looking at VS Code's APIs for extensions. In particular,
  the ["View Zones" and "Overlays"](https://github.com/Microsoft/monaco-editor/issues/83#issuecomment-272396825)
  functionality seems promising
  for showing multiline information alongside the code.
  ([API signatures](https://github.com/microsoft/vscode/blob/7c78640d86e5de1ca0270912584d9d38beafeec1/src/vs/editor/browser/editorBrowser.ts#L29))

### Build system

- Initial investigative work into using Bazel for building things.
  It feels like a high complexity solution,
  but I think it's probably the "right" thing in the long run
  to ensure incrementality and reproducibility.
  This is especially problematic
  because of the number of languages involved:
  - (likely) Rust for the core compiler and runtime.
  - JavaScript/TypeScript for a VS Code extension.
  - A C/C++ toolchain for compiling the tree-sitter grammar.
    Ideally, tree-sitter would generate Rust code,
    but that seems like a big undertaking,
    given that the tree-sitter runtime
    has a bunch of C code (10k~15k lines).
  - Maybe Racket/Scribble for docs?
