# Rust interop

NOTE: The below is focused mainly on consuming Rust code from Miu,
not on consuming Miu code from Rust.

## Monomorphic code

### Interpreted mode

1. Obtain type signatures + ABIs for public functionality.
2. Check for type errors across the boundary.
3. Compile Rust code to a dynamic library.
4. Dynamically load Rust library in interpreter.
5. At language boundary, perform any type conversions and/or
   validity checks as needed in interpreter.

### Compiled mode

1. Obtain type signatures + ABIs for public functionality.
2. Check for type errors across the boundary.
3. Compile Rust code to a static library.
4. Compile Miu code with appropriate ABI

### Variation - link dependency vs pure data dependency

For step 1 "Obtain type signatures + ABIs",
there are a couple of possible approaches we could take:
- Have a link dependency on rustc in the main Miu compiler.
  We would likely reuse some types, methods etc.
- Have a pure data dependency on rustc. There would be
  an "ABI generator" wrapper which emits type information
  as well as ABI information, say as a SQLite database.
  We'd consume information from the database directly,
  so there wouldn't be any reuse of types or methods.
  Any information that is needed needs to be serialized.

Here are the different factors involved:
- **Build system complexity**: rustc has a complicated build system.
  If we can minimize the surface area where we interact with it,
  we are likely to get better build caching.
  For example, Bazel-ifying rustc's codebase would be a daunting
  task, but it seems a lot more doable with just rust-analyzer,
  since it is pure Rust.

  Most people working on Miu wouldn't need to build rustc at all,
  they can download a prebuilt binary for the "ABI generator."
- **Architectural concerns**: Separating internal data structures
  from those used by rustc, gives us more architectural freedom.

  For example, we don't need to worry about
  any I/O happening behind the scenes
  within the Rust compiler.
  rustc also heavily uses thread-local storage,
  which may be an issue
  if we want to have more fine-grained concurrency.

  I'm less concerned about this aspect with rust-analyzer,
  as I think it is written as a "pure function"
  (but I should double-check to what extent that is true).
- **Single code path**: One not-uncommon source of bugs in Swiftc
  used to be differences in behavior when loading information
  from a pre-compiled swiftmodule vs a swiftinterface.
  Using in-memory data transfer (with perhaps optional caching
  via a database) introduces a similar problem
  where the "same" thing can happen along two different code paths.
  By funneling all data through a single code path,
  we'd get more testing for it
  and eliminate the chances of inconsistent behavior.
- **Incrementality and pipelining**: By reusing rustc's
  infrastructure for incremental compilation,
  it might be easier to get cross-language incremental compilation.
  Similarly, by reusing that infrastructure,
  we could potentially have cross-language pipelining
  (i.e. some Miu code can start compiling
  while the Rust code hasn't finished compiling).
  Using a "serialize everything first" approach
  precludes both of these.

  However, databases do seem to have
  at least some support for notifications.
  For example, SQLite has [sqlite3_update_hook](https://www.sqlite.org/c3ref/update_hook.html).
- **N-step handoff**: Step 1 is described as a
  "single thing" but with the ability to use polymorphic
  types from Rust (see below), you need to break apart
  the "ABI generator" into two steps.
  1. First generate type definitions for Rust code
     and use this to type-check Miu code,
     identifying the specializations needed from rustc.
  2. Generate ABI information in rustc, and consume
     that from the Miu compiler.
  This is more tedious to coordinate across processes
  than across a linkage boundary.

  Additionally, this is just polymorphic types.
  I haven't even fully thought through what it would
  take to get traits to work (e.g. could you implement
  Rust traits in Miu code?).

### Alternative approach - generated repr(C) shim

Another option is to create a shim crate
that imports the crate one wants to use,
and wraps its functionality using `#[repr(C)]` stubs
that handle cross-language conversions.
The shim would statically link in the Rust crate,
and itself be exposed as a dynamic library (in interpreted mode)
or as a static library (in compiled mode).

Benefits:
- Easier to debug, by looking at the generated code.
- Only need a C ABI, don't need to worry about Rust ABI.

Drawbacks:
- Doesn't work for non-C types, which seems important.
- Potentially higher overhead

## Polymorphic code

This is more complicated.
For example, if you want to write code like:

```miu
import rust/std/vec/Vec

type Point = { x : Int, y : Int }

let points : Vec Point = ...
```

We need to essentially specialize across the language boundary
by passing a Miu type to the Rust compiler.
However, that would likely require changing rustc internals
to a large extent.
Instead, one possiblity is to synthesize a fake type
with the same ABI as `Point`,
have rustc do the codegen for that.

## Reflecting mandatory monomorphization in types

I think we should distinguish type parameters
which can optionally be monomorphized vs
which must be monomorphized.

I think the best way to do this is probably via kinds.
(See also: [Kinds are Calling Conventions](./Bibliography.md#kinds-are-calling-conventions).)
There would be at least two kinds, (working names)
`Type` and `MachineType`. Types of kind `MachineType`
would require monomorphization.

Why kinds? Because using kinds lets us check and specify
the necessity for monomorhization in a modular way.
If you have an abstract polymorphic type,
you need to be able to check its usages:

```miu
type V2 (N : MachineType) -- kept abstract
let repeat : [N : MachineType](N) -> V2 N

-- In a different module
let repeat-twice[n : Type](n) -> {V2 n, V2 n} 
let repeat-twice(x) = {repeat(x), repeat(x)}
```

It is not possible to compile `repeat-twice` polymorphically,
because `V2` requires that the type parameter be monomorphized.
For example, `V2` may actually be implemented in Rust, not in Miu.

It makes more sense to surface such an error during semantic analysis
instead of during code generation.
