// TODO: [Varun] Add documentation.
// TODO: [Varun] Add support for operators.

//------------------------------------------------------------------------------
// Combinators

// main with sep in-between, with a sep at the start.
const sepStartStrict1 = (sep, main) => repeat1(seq(sep, main));

// main with sep in-between, with a sep at the start.
const sepStartStrict = (sep, main) => repeat(seq(sep, main));

// main with sep in-between, with a sep at the end.
const sepEndStrict = (main, sep) => repeat(seq(main, sep));

// main with sep in-between, with an optional sep at the end.
const sepEndOptional = (main, sep) => seq(
      repeat(seq(main, sep)),
      optional(main)
    );

// main with sep in-between, and with an optional trailer
// - The trailer may optionally have a sep after it
// - If the trailer is present and there are 'main' elements,
//   there will be sep between the trailing and main
const sepEndOptionalTrailer = (main, sep, trailer) => choice(
    optional(sepEndOptional(main, sep)),
    seq(trailer, optional(sep)),
    seq(sepEndStrict(main, sep), trailer, optional(sep)),
  );

// Similar to sepEndOptional but trailing sep is required if there is only 1 main.
const sepEndOptionalAlt = (main, sep) => optional(sepEndOptionalAlt1(main, sep));

// Similar to sepEndOptional1 but trailing sep is required if there is only 1 main.
const sepEndOptionalAlt1 = (main, sep) => seq(
    main, sep, sepEndOptional(main, sep)
  );

// Similar to sepEndOptional, but at least 1 occurrence of main is required.
const sepEndOptional1 = (main, sep) => seq(
    main,
    repeat(seq(sep, main)),
    optional(sep)
  );

const re = {
  join: (...rs) => new RegExp('(' + rs.map(r => r.toString().slice(1, -1)).join() + ')'),
  or: (...rs) => new RegExp('(' + rs.map(r => r.toString().slice(1, -1)).join('|') + ')'),
  zeroOrMore: r => new RegExp('(' + r.toString().slice(1, -1) + ')*'),
  oneOrMore: r => new RegExp('(' + r.toString().slice(1, -1) + ')+'),
  optional: r => new RegExp('(' + r.toString().slice(1, -1) + ')?'),
};

//------------------------------------------------------------------------------
// Precedence

const prec_table = {
  "comment": 100,
  "unitful_type": 15,
  "unitful_expr": 11,
  "application": 11,
  "boolean_not": 10,
  "measure_ident": 8,
  "measure_pow": 7,
  "measure_div": 6,
  "measure_mul": 5,
  "row_union": 5,
  "row_concat": 5,
  "row_merge": 5,
  "boolean_and_or": 4,
  "lambda": 4,
  "let": 3,
  ";": 1,
};

//------------------------------------------------------------------------------
// Operators and quantifiers

const _LAMBDA = /fun|λ/;
const _FORALL = /forall|∀/;
const _EXISTS = /exists|∃/;

const _ARROW = /->|→/;
const _BACK_ARROW = /<-|←/;

const _ROW_UNION = /\|_\||⨆/;
const _ROW_CONCAT = /\+\+|⧺/;
const _ROW_MERGE = /\|\+\||⨄/;

//------------------------------------------------------------------------------
// Brackets

const _ROW_BRACKETS = { open: /#\(/, close: /\)/ };
const _RECORD_BRACKETS = { open: /#\{/, close: /\}/ };
const _VARIANT_BRACKETS = { open: /#\[/, close: /\]/ };

//------------------------------------------------------------------------------
// Names

const PACKAGE_NAME = /[A-Za-z]+((\-|\.)[A-Za-z0-9]+)*/;
const IDENTIFIER = /[A-Za-z]+(\-[_A-Za-z0-9]+)*/;
const LABEL = IDENTIFIER;

// info holes are interpreted as 'show me the type' in expression contexts
// and in pattern contexts.
const INFO_HOLE = re.join(/_\?/, /[A-Za-z0-9]*/);
// wildcards are interpreted as ignored in pattern contexts
// and as breakpoints (if the code ever gets here, trigger
// a breakpoint and let me fill in the value) in a debugging context
const WILDCARD = re.join(/_/, IDENTIFIER);

const HOLE = re.or(WILDCARD, INFO_HOLE);

const IDENTIFIER_OR_INFO_HOLE = re.or(IDENTIFIER, INFO_HOLE);
const IDENTIFIER_OR_HOLE = re.or(IDENTIFIER, HOLE);


// Use a prefix to distinguish variant tags in unqualified pattern matching.
const ANONYMOUS_TAG = /[0-9]+/;
const NAMED_NOMINAL_VARIANT_TAG = IDENTIFIER;
const DOT_PREFIXED_NOMINAL_VARIANT_TAG = re.join(/\./, re.or(IDENTIFIER, ANONYMOUS_TAG));
const STRUCTURAL_VARIANT_TAG = re.join(/'/, re.or(IDENTIFIER, ANONYMOUS_TAG));

const _PATH_PREFIX = re.zeroOrMore(re.join(IDENTIFIER, /[\/\.]/));
const PATH = re.join(_PATH_PREFIX, IDENTIFIER);

// Foo..Some
//

//------------------------------------------------------------------------------
// Literals

const underPathStrict = (litRegex) => 
    seq(PATH, token.immediate(/\//), token.immediate(litRegex));

const underPath = (litRegex) => choice(
    underPathStrict(litRegex),
    litRegex,
  );

//------------------------------------------------------------------------------
// Argument and parameter lists (values and types)

const call_args = ($) => sepEndOptional(
  seq(optional(seq($.param_label, '=')), $.expr),
  ','
);

const fn_type_expr_args = ($, start_tok, end_tok) => seq(
  optional(seq(token.immediate('['), call_type_args($), ']')),
  token.immediate(start_tok),
  call_args($),
  end_tok
);

const call_type_arg = ($) => choice($.type, seq(IDENTIFIER, '=', $.type));
const call_type_args = ($) => sepEndOptional(call_type_arg($), ','); // FIXME

const call_like_expr = ($, start_tok, end_tok) => prec.left(prec_table["application"], seq(
  field('function', $.expr),
  fn_type_expr_args($, start_tok, end_tok),
));

//------------------------------------------------------------------------------
// Patterns

// [1, .., 2], LibraryType/{x, y, ..}
const _DOT_DOT = '..';

//------------------------------------------------------------------------------
// Whitespace and layout

const WHITESPACE = /\s+/;

// Always having ...end enables using tooling like Comby.
const blocky_general = (herald, sep, entry) =>
  sep === ''
    ? seq(herald, repeat(entry), 'end')
    : seq(herald, sepEndOptional(entry, sep), 'end');

const type_block = (entriesWithSep) => seq('where', entriesWithSep, 'end');

// Using 'do' gives a convenient place to add scoped effect markers in
// the future, and reduces the number of places in the grammar using braces.
// https://twitter.com/typesanitizer/status/1550470993369792512
//
// const blocky_expr_like = (entry) => blocky_general('do', ',', entry);

//------------------------------------------------------------------------------
// Main stuff

const source_file = ($) => repeat($.top_level_decl);
  // sepEndOptional($.top_level_decl, WHITESPACE);
  // repeat(seq($.top_level_decl, $._newline));

const maybe_type = ($) => optional($._with_type);

module.exports = grammar({
  name: 'miu',

  extras: $ => [WHITESPACE, $.comment],
  conflicts: $ => [
    [$.unitful_expr, $.watch_decl]
  ],
  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => source_file($),

    unified_source_file: $ => sepEndOptional(
      seq('#start ',
          optional(seq('package:', PACKAGE_NAME, ',')),
          optional(seq('exported:', choice('true', 'false'), ',')),
          $.filepath,
          '(\r)?\n---+(\r)?\n',
          source_file($),
          '(\r)?\n---+(\r)?\n',
          '#end', optional($.filepath)),
      /\n+/),
    filepath: $ => /.+/,

    // Using Lean's comment syntax makes // available for integer division.
    comment: $ => token(choice(
        prec(prec_table["comment"], seq('--', /.*/)),
        // Don't allow nested comments for now...
        /\/-.*-\//s,
    )),

    top_level_decl: $ => choice(
      $.import_decl,
      $.namespace_decl,
      $.let_sig,
      $.fun_sig,
      $.let_decl,
      $.fun_decl,
      $.kind_sig,
      $.type_decl,
      $.watch_decl,
    ),

    // Helpers
    _with_type: $ => seq(':', $.type),

    // import X1/X2
    // import X1/X2.M1 as M
    // import X1/[X2.M1 as M, A0.[N1 as N, N2]]
    import_decl: $ => seq(
      'import', $.import_tree
    ),
    import_tree: $ => choice(
      seq(PATH, optional(seq('as', IDENTIFIER))),
      seq(PATH, token.immediate(choice('/[', '.[')), sepEndOptional($.import_tree, ','), ']')
    ),

    // namespace MySpace where
    //   decl1
    //   decl2
    // end
    namespace_decl: $ => seq('namespace', IDENTIFIER_OR_INFO_HOLE, type_block($.top_level_decl, '')),

    // let id1, ..., idN : Type
    let_sig: $ => seq(
      'let', sepEndOptional1(IDENTIFIER_OR_INFO_HOLE, ','), ':', $.type
    ),

    // Why a separate keyword to declare functions,
    // if functions are first-class values?
    // It seems helpful to be able to quickly visually distinguish
    // between "methods" and non-"methods".
    // 
    // Additionally, argument labels are not part of a function's type,
    // so they cannot be represented in a 'let ident : Type' form.
    // However, argument labels are a generally useful feature.
    //
    // Why not have named return values?
    // Named return values are needed a lot less often, so it's OK
    // to use an anonymous record for them.
    //
    // Argument labels do not allow defaulting though, so if you want

    // sig max[Ordered c](c, c) -> c
    // sig new-range[Ordered c](low : c, high : c) -> Range c
    // sig new[a](capacity: UInt = 0) -> Vec a
    fun_sig: $ => seq(
      'sig' /* use 'sig' for now to disambiguate */,
      IDENTIFIER_OR_INFO_HOLE,
      optional($._type_param_list),
      $.fun_sig_param_list,
      $._fun_arrow,
      $.type,
    ),
    param_label: $ => LABEL,
    fun_sig_param_list: $ => seq('(',
      sepEndOptional(
        choice(
          $.type,
          seq($.param_label, $._with_type, optional(seq('=', $.expr)))
        ),
      ','),
    ')'),

    // let id1 = expr
    // let id2 : Type = expr
    let_decl: $ => seq(
      // info holes can be used here for filling in class methods
      'let', optional('rec'), IDENTIFIER_OR_INFO_HOLE, maybe_type($), '=', $.expr,
    ),

    // fun combineMany[m](x, y) : m = 
    fun_decl: $ => seq(
      'fun', optional('rec'),
      IDENTIFIER_OR_INFO_HOLE,
      optional($._type_param_list),
      $.fun_decl_param_list,
      $._fun_arrow,
      '=',
      $.expr
    ),
    fun_decl_param_list: $ => seq('(', sepEndOptional(seq($.let_lhs, maybe_type($)), ','), ')'),

    _type_param_list: $ => seq('[', sepEndOptional($.type_param, ','), ']'),
    // a, ∃ a, ∃ n : Natural, m ~ Succ n
    type_param: $ => choice(
      seq(
        // quantifier
        optional(re.or(_FORALL, _EXISTS)),
        // type parameter name
        sepEndOptional1(IDENTIFIER, /\s+/),
        // optional kind annotation
        maybe_type($)
      ),
      $.type_constraint
    ),
    type_constraint: $ => choice(
      $.app_type,
      seq($.type, '~', $.type), // should we use == here?
    ),
    
    _value_param_list: $ => seq('(', sepEndOptional($.value_param, ','), ')'),
    value_param: $ => seq(IDENTIFIER, maybe_type($)),

    // type T1 : K1
    // type T1, ..., TN : K1
    kind_sig: $ => seq(
      'type', sepEndOptional1(IDENTIFIER, ','), ':', $.type // kind
    ),

    // type T1 p1 = Type
    //
    // type T1 p1 : K where
    //   | 'Tag1(T2, T3)
    //   | 'Tag2
    // end
    //
    // type T (p1, p2 : K1) where
    //   f1 : p1,
    //   f2 : p2,
    // end
    // type T1 tp1 (tp2 : K1) ... tpN : K where end
    type_decl: $ => seq(
      'type', IDENTIFIER,
      field('type_parameters', repeat($.type_decl_type_param)),
      field('kind_annotation', maybe_type($)),
      choice(
        field('type_alias', seq('=', $.type)),
        field('variant',
          // use | on a zero-case variant to disambiguate between
          // zero-case variants and zero-case records
          choice('|', type_block(sepStartStrict1('|', $.type_decl_case)))
        ),
        field('record', type_block(sepEndOptional($.type_decl_field, ',')))
      )
    ),
    type_decl_type_param: $ => choice(
      IDENTIFIER,
      seq('(', sepEndOptional1(IDENTIFIER, ','), $._with_type, ')')
    ),
    type_decl_case: $ => seq(
      NAMED_NOMINAL_VARIANT_TAG,
      optional(seq('(', sepEndOptional(choice($.type, $.type_decl_field), ','), ')'))
    ),
    type_decl_field: $ => seq(IDENTIFIER, $._with_type),

    watch_decl: $ => choice(
      seq(/#view/, $._expr_or_type),
      seq(/#check/, $._expr_or_type),
      seq(/#assert/, $.expr),
    ),
    _expr_or_type: $ => choice($.expr, seq('type', $.type)),

    type: $ => choice(
      $.literal_type,
      PATH,
      HOLE,
      $.function_type,
      $.app_type,
      $.record_type,
      $.variant_type,
      $.row_type,
      $.unitful_type,
      $.type_binop,
      seq('(', $.type, ')'),
    ),

    literal_type: $ => choice(
      /[0-9]+/,
      /"(\\"|[^"])*"/
    ),

    _fun_arrow: $ => seq(
      _ARROW,
      optional(seq(token.immediate('['), sepEndOptional($.effect_type, ','), ']')),
      WHITESPACE,
    ),

    // (Int) -> Int
    // (Int) ->[IO] {}
    // [Display a](a) ->[IO] {} // sugar for [a : Type, Display a](a) ->[IO] {}
    // [a](Bool, () ->[e1] a, () ->[e2] a) ->[e1, e2] a
    function_type: $ => seq(
      optional($._type_param_list),
      '(', sepEndOptional($.type, ','), ')',
      $._fun_arrow,
      $.type
    ),
    // if : (cond : Bool, ifTrue : () ->[e1] a, ifFalse : () ->[e2] a) ->[e1, e2] a
    effect_type: $ => choice(
      IDENTIFIER_OR_HOLE,
      $.app_type,
      seq('-', IDENTIFIER_OR_INFO_HOLE), // removing an _ effect doesn't make sense
    ),

    app_type: $ => prec.left(prec_table["application"], (seq($.type, $.type))),

    // |_|/⨆ for union -- only works for labelled rows
    // ++/⧺ for concatenation -- only works for unlabelled rows
    // |+|/⨄ for merging -- works for both unlabelled and labelled rows
    record_type: $ => choice(
      $.unlabeled_record_type, $.labeled_record_type
    ),
    unlabeled_record_type: $ => seq(
      '{',
      sepEndOptionalAlt($.type, ','),
      optional(seq('..', $.type)),
      '}'
    ),
    labeled_record_type: $ => seq(
      '{',
      sepEndOptionalAlt1($.labeled_record_type_entry, ','),
      optional(seq('..', $.type)),
      '}'
    ),
    labeled_record_type_entry: $ => seq(IDENTIFIER_OR_INFO_HOLE, ':', $.type),

    // [ 'Tag1(...) | 'Tag2 | .. ]
    variant_type: $ => seq(
      '[|]', // ~ Never ~ forall a. a
      '[', sepEndOptionalAlt1(choice($.type, $.variant_type_entry), '|'), optional(seq('..', $.type)), ']'
    ),
    variant_type_entry: $ => seq(
      STRUCTURAL_VARIANT_TAG,
      optional(
        choice(
          seq('(', sepEndOptional($.type, ','), ')'),
          seq('(', sepEndOptional1($.labeled_record_type_entry, ','), ')')
        )
      )
    ),

    row_type: $ => seq(
      _ROW_BRACKETS.open, sepEndOptional(seq($._row_label, $._with_type), ';'), _ROW_BRACKETS.close,
    ),
    _row_label: $ => IDENTIFIER_OR_INFO_HOLE,

    expr: $ => choice(
      // PATH,
      // HOLE,
      $.literal_expr,
      // $.data_expr,

      $.let_expr,
      // $.lambda_expr,

      // $.apply_expr,
      // $.subscript_expr,

      // $.boolean_expr,

      // $.if_expr,
      // $.match_expr,

      // $.for_expr,
      // $.break_expr,
      // $.return_expr,

      // $.unitful_expr,
      // $.sequence_expr,
    ),

    sequence_expr: $ => prec.left(prec_table[";"], seq($.expr, ';', $.expr)),

    // Signature ideas for conversion functionality.
    // tryConvert : [| 'FromInt64 (Int64 ->! a) | 'FromInteger (Integer ->! a) |]
    // tryConvert : [| 'FromBytes (Bytes ->[Throws CompilerError] a)
    //               | 'FromString (String ->[Throws CompilerError] a) |]
 
    literal_expr: $ => choice(
      // integer literal: 3, Integer/100000000000000000000
      underPath(/-?[0-9]+/),
      // string literal: "hello", Bytes/"\ud800"
      underPath(/".*"/),
      // array literal: [1, 2], [3; "", "", ""], V2/[2, 3], V3/[0, 1, 2]
      seq(
        underPath(/\[/),
        optional(seq($.expr, ';')),
        sepEndOptional($.expr, ','),
        ']',
      ),
    ),

    // tuples are like structs anyways
    // anonymous non-extensible sums are similar...
    // 
    // ABI for structural variants...
    //
    // pass an offset array on the side
    //
    // {} = Unit
    // { Int, String } <- Anonymous record
    // { x : Int, y : String } <- Extensible record
    // [|] <- equivalent to Never
    // [ Int | String ] <- Anonymous variant, construct '0(10)
    // [ 'Foo(Int) | 'Bar(Int) ] <- Extensible variant
    //
    // [|]
    // [ 'Foo(Int) ]
    //
    // let x = JSON/new([ k := 10, v := 20 ])
    //
    // partition -> '{ satisfied : [a], not-satisfying : [a] }
    //
    // Int'[m/s]
    // 
    // Int`[m/s]
    //
    // Int |[m/s]
    //
    // 3 `[m/s]
    //
    // Int `[m/s]
    //
    // a`[u] -> b`[v] ->[Effect] Output`[u v]
    //
    // Int'[m/s]
    // 
    //
    // x .[m / s]
    //
    // '{x = 10, y = 10} <> '{z = 20}
    //
    // '[], '['Foo(Int) | 'Bar(Int) ]
    //
    // structural records allow splicing operations

    // structural record
    // { x : 10, y : 10 }
    // structural variant
    // [|] or [ Int | String | ]

    data_expr: $ => choice(
      $.nominal_record_expr,
      $.structural_record_expr,
      // $.nominal_variant_expr,
      // $.structural_variant_expr,
    ),

    // Point/{10, 10}
    // Point/{x = 10, y = 10}
    // .{10, 10}
    // .{x = 10, y = 10}
    nominal_record_expr: $ => seq(
      field('type_prefix', choice(underPathStrict('{'), '.{')),
      field('entries', sepEndOptional($.record_expr_entry, ',')),
      '}'
    ),
    // { 10, 20 }
    // { x = 1, y = 1 }
    structural_record_expr: $ => choice(
      seq('{', sepEndOptional($.record_expr_entry, ','), '}')
    ),
    record_expr_entry: $ => choice($.expr, seq($._row_label, '=', $.expr)),

    // some(x) <- handled in apply_expr
    // none <- handled in IDENTIFIER inside $.expr
    // Option/none <- handled in PATH inside $.expr
    // Option/some(x) <- handled in apply_expr in $.expr
    // .some(x)
    // .none
    // nominal_variant_expr: $ => seq(
    //   DOT_PREFIXED_NOMINAL_VARIANT_TAG,
    //   optional(fn_type_expr_args($, '(', ')')),
    // ),
    // structural_variant_expr: $ => seq(
    //   STRUCTURAL_VARIANT_TAG,
    //   optional(fn_type_expr_args($, '(', ')')),
    // ),

    // let
    //   x = expr,
    //   y = expr,
    //   z = expr,
    // in 
    // Q: Does associativity even make sense for 'let'
    let_expr: $ => prec.left(prec_table["let"], seq('let', $.let_entry)),
    // let_expr: $ => prec.right(prec_table["let"], seq(
    //   'let', optional('rec'),
    //   blocky_general($, $.let_entry, sepEndOptional1($.let_entry, ';'), ''),
    //   'in', $.expr
    // )),

    let_lhs: $ => IDENTIFIER,

    let_entry: $ => seq($.let_lhs, '=', $.expr),

    // module String where
    //
    //   instance Monoid String where
    //     let empty : String = ""
    //     fun combine(x, y) = x.append(y)
    //   end
    //
    // module String where
    //   namespace Array where
    //     fn join[]
    //   end
    // end
    //
    // import base/text/String String.Utils/
    //
    //

    // instance Monoid MyType where
    //   fun combineMany 
    //
    // fun (x, y) -> x + y
    // fun[M : Monoid m](x : a) -> M.combineMany([x, x, x])
    lambda_expr: $ => prec.right(prec_table["lambda"], seq(
      _LAMBDA,
      optional($._type_param_list),
      $._value_param_list,
      choice(seq($._fun_arrow, '='), _ARROW),
      $.expr
    )),

    boolean_expr: $ => choice(
      prec(prec_table["boolean_not"], seq('not', $.expr)),
      prec.left(prec_table["boolean_and_or"], seq($.expr, choice('&', '|'), $.expr)),
    ),

    apply_expr: $ => call_like_expr($, '(', ')'),
    subscript_expr: $ => call_like_expr($, '.[', ']'),
    
    // if cond -> expr,
    //    cond -> expr,
    // end
    //
    // if :-> Type do
    //   cond -> expr,
    //   cond -> expr,
    // end
    if_expr: $ => seq(
      'if',
      choice(
        seq($._result_type, blocky_general('do', ',', $.if_branch)),
        blocky_general('', ',', $.if_branch),
      ),
    ),

    _result_type: $ => seq(':', _ARROW, $.type),

    // match expr with
    //   guard -> expr,
    //   guard -> expr,
    // end
    //
    // match expr :-> Type with
    //   guard -> expr,
    //   guard -> expr,
    // end
    //
    // fun match
    //   guard -> expr,
    //   guard -> expr,
    // end
    //
    // fun match :-> Type with
    //   guard -> expr,
    //   guard -> expr,
    // end
    match_expr: $ => choice(
      seq(_LAMBDA, 'match',
        choice(
          seq($._result_type, blocky_general('with', ',', $.match_branch)),
          blocky_general('', ',', $.match_branch),
        )
      ),
      seq('match', $.expr, optional($._result_type), blocky_general('with', ',', $.match_branch))
    ),

    if_branch: $ => seq(
      $.guard,
      _ARROW,
      $.expr,
    ),
    match_branch: $ => seq(
      $.pattern,
      // Disallow (pattern | guard) as it will be technically ambiguous.
      // E.g. if guard is an identifier, we could interpret it as pattern | pattern too.
      //
      // Instead, if you ever want to write
      //   pattern | guard
      // you can instead write it as:
      //   id | (let pattern <- id & guard)
      optional(seq('&', $.guard)),
      _ARROW,
      $.expr,
    ),
    guard: $ => choice(
      $.expr,
      seq('let', $.pattern, _BACK_ARROW, optional('not'), $.expr),
      prec.left(prec_table["boolean_and_or"], seq($.guard, choice('|', '&'), $.guard)),
      seq('(', $.guard, ')'),
    ),

    unitful_expr: $ => prec.left(prec_table["unitful_expr"], seq(
      $.expr,
      '\'[',
      $.measure_type,
      ']'
    )),
    unitful_type: $ => prec.left(prec_table["unitful_type"], seq(
      $.type,
      '\'[',
      $.measure_type,
      ']'
    )),
    measure_type: $ => choice(
      prec.left(prec_table["measure_ident"], IDENTIFIER_OR_HOLE), // more important than type's IDENTIFIER_OR_HOLE.
      prec.right(prec_table["measure_pow"], seq($.measure_type, '^', /[0-9]+/)),
      prec.left(prec_table["measure_div"], seq(choice($.measure_type, '1'), '/', $.measure_type)),
      prec.left(prec_table["measure_mul"], seq($.measure_type, optional(choice('*', '⋅' /* U+225c */)), $.measure_type)),
      seq('(', $.measure_type,')')
    ),
    type_binop: $ => choice(
      prec.left(prec_table["row_union"],  seq($.type, _ROW_UNION,  $.type)),
      prec.left(prec_table["row_concat"], seq($.type, _ROW_CONCAT, $.type)),
      prec.left(prec_table["row_merge"],  seq($.type, _ROW_MERGE,  $.type)),
    ),

    pattern: $ => choice(
      IDENTIFIER_OR_HOLE,
      /\?unknown/,
      // Use to suppress warnings, for example:
      // let b = 0
      // let _ = match a
      //   'Some(b) -> 3, -- warning: 'b' inside the pattern creates a new binding,
      //                  --          which shadows 'b' on line ...
      //                  --          the pattern match may be misinterpreted as a comparison
      //                  -- option 1: to create a new binding, use 'let b'
      //                  -- option 2: to compare against the outer 'b'
      //                  --           rename the inner 'b' to 'b_' and add '& b == b_'
      //   _ -> 1,
      // Can be extended with 'mut' in the future
      seq('(', $.let_pattern, ')'),
      prec.left(prec_table["boolean_and_or"], seq($.pattern, '|', $.pattern)),
      seq('val', $.expr), // shortcut to avoid creating a binding and then using '=='
      $.data_pattern,
    ),

    let_pattern: $ => seq(optional('let'), $.pattern),
    data_pattern: $ => choice(
      $.record_pattern,
      $.variant_pattern,
    ),
    record_pattern_entry: $ => choice($.let_pattern, seq($._row_label, '=', $.let_pattern)),
    record_pattern: $ =>
      seq(underPath('{'), sepEndOptionalTrailer($.record_expr_entry, ',', _DOT_DOT), '}'),
    variant_pattern: $ => seq(
      choice(PATH, DOT_PREFIXED_NOMINAL_VARIANT_TAG),
      optional(
        seq('(', sepEndOptionalTrailer($.record_pattern_entry, ',', _DOT_DOT), ')')
      )
    ),
  }
});
