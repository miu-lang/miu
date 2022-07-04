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
However, that would likely require changing Rustc internals
to a large extent.
Instead, one possiblity is to synthesize a fake type
with the same ABI as `Point`,
have Rustc do the codegen for that.

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
