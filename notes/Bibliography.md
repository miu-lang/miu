# Bibliography

NOTE: Use Chicago style from Google Scholar.

## Kinds are Calling Conventions

Citation: Downen, Paul, Zena M. Ariola, Simon Peyton Jones, and Richard A. Eisenberg. ["Kinds are calling conventions."](https://dl.acm.org/doi/pdf/10.1145/3408986) Proceedings of the ACM on Programming Languages 4, no. ICFP (2020): 1-29.

## Three Architectures for a Responsive IDE

Citation: https://rust-analyzer.github.io/blog/2020/07/20/three-architectures-for-responsive-ide.html

### Notes

> it’s not the incrementality that makes and IDE fast. Rather, it’s laziness — the ability to skip huge swaths of code altogether.
>
> With map-reduce, the index tells us exactly which small set of files is used from the current file and is worth looking at. Headers shield us from most of the implementation code.

### Questions

It's not super clear why the map-reduce style architecture can't work
for a Rust-like language. Using the example in the blog post:

```
// File: ./foo.rs
trait T {
    fn f(&self) {}
}
// File: ./bar.rs
struct S;

// File: ./somewhere/else.rs
impl T for S {}

// File: ./main.s
use foo::T;
use bar::S

fn main() {
    let s = S;
    s.f();
}
```

> Here, we can easily find the S struct and the T trait (as they are imported directly). However, to make sure that s.f indeed refers to f from T, we also need to find the corresponding impl, and that can be roughly anywhere!

You could maintain an index that maps:
```
(TypeName, MethodName) => Vec<(Option<Trait>, SourceRange)>
```
You'd do a lookup for `(S, f)`. If you find a hit,
check if the traits (or inherent methods) are in scope or not.

One problem with this is invalidation.
I suspect there is an underlying point which is not explained fully
in the post:

> Each file is being indexed, independently and in parallel, producing a "stub" — a set of visible top-level declarations, with unresolved types.
>
> All stubs are merged into a single index data structure.

Here, the stub "merge" operation does not involve merging hash tables
(which would be required by the above `(TypeName, MethodName)`-keyed table),
but rather creating a two-level index,
with the top-level index keyed by file.
That allows quickly blowing away the per-file index.
But this means that a small set of files is _necessary_
for a fast search.

However, Ruby allows "monkey-patching" existing classes
(similar to extension methods in Swift), so Sorbet
likely has code for handling this quickly.
At the same time, matklad describes Sorbet
as having a map-reduce style architecture.
I should look at Sorbet's code more closely
to figure out what is going on.
