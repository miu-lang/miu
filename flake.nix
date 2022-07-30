{
  description = "The Miu monorepo";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  # flake-utils is unused
  outputs = { self, nixpkgs, flake-utils }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];

      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;

      nixpkgsFor = forAllSystems (system: import nixpkgs { inherit system; });
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = nixpkgsFor.${system};
        in
        rec {
          miu = pkgs.stdenv.mkDerivation rec {
            pname = "miu";
            version = "0.0.0";
            nativeBuildInputs = builtins.attrValues { inherit (pkgs) cacert cargo rustc bazel_5 tree-sitter ; };
            # iconv is needed by Rust regex stuff
            buildInputs = builtins.attrValues { inherit (pkgs) libiconv ; };
            buildPhase = ''
              # Keep in sync with ci.yml
              bazel build --crosstool_top=@nixpkgs_config_cc//:toolchain //...
              '';
            # I don't know what the packaging expectations for output files are.
            installPhase = "mkdir $out && touch $out/placeholder";
            src = builtins.path { path = ./.; name = "miu"; };
          };
          default = miu;
        }
      );

      # defaultPackage = forAllSystems (system: self.packages.${system}.miu);

      devShells = forAllSystems (system:
        let
          pkgs = nixpkgsFor.${system};
        in
        {
          default = pkgs.mkShell {
            nativeBuildInputs = builtins.attrValues { inherit (pkgs) cacert cargo rustc rustfmt pre-commit bazel_5 tree-sitter fzf ripgrep fd; };
            RUST_SRC_PATH = pkgs.rustPlatform.rustLibSrc;
          };
        }
      );
    };
}
