# Development Log

## July 5 2022

### Direction

- It seems like one of the key blockers to progress
  is understanding the overall architecture
  that will be needed for Rust interop,
  and what tradeoffs it will have.
  (Bunch of these are unknowns, since I'm not very familiar
  with the architecture of rust-analyzer or rustc.)
  There are multiple options,
  as noted in the [Rust interop](./RustInterop.md) doc,
  but it's not clear which one is the "right" one.

  Perhaps it would be useful to first write down
  some fake code examples of Rust interop,
  what the use case for the code example would be,
  and what the compiler's behavior should be like.

  It would also be useful to spend a few days understanding
  the overall pipeline in both rustc and rust-analyzer,
  and making notes for each.

### Rust interop

- Wrote some notes about having a link-dependency on Rustc
  vs having a pure data dependency
  by serializing all necessary information "ahead-of-time".

### Rustc exploration

- Spent some time reading code in the `rustc_interface` crate.
  One of the odd things I noticed is that there is a separate
  `parallel_compiler` configuration option; without it,
  the configuration skips using `Send`/`Sync` types
  (like `Rc` instead of `Arc`).
  I wonder when that configuration is used,
  maybe it's for distributed builds?

## July 4 2022

### Rustc internals

- It seems like Rustc has some internal APIs that can be used.
  They "try not to break things unnecessarily" according to the
  docs on [rustc_driver](https://rustc-dev-guide.rust-lang.org/rustc-driver.html).
  I suspect it's probably best to use Rustc instead of rust-analyzer
  for the batch compiler,
  because we need access to backend information anyways.
  For the IDE compiler, it would make sense to use rust-analyzer. 
  However, the first thing I'd like to do
  is test if this concept can even work or not.
  So it makes sense to try out Rustc first.

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
