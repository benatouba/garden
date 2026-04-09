{
  inputs = {
    devenv-root = {
      url = "file+file:///dev/null";
      flake = false;
    };
    flake-parts.url = "github:hercules-ci/flake-parts";
    flake-parts.inputs.nixpkgs-lib.follows = "nixpkgs";
    devenv.url = "github:cachix/devenv";
    nixpkgs.url = "github:cachix/devenv-nixpkgs/rolling";
    nix2container.url = "github:nlewo/nix2container";
    nix2container.inputs.nixpkgs.follows = "nixpkgs";
    mk-shell-bin.url = "github:rrbutani/nix-mk-shell-bin";
  };

  outputs =
    inputs@{ flake-parts, nixpkgs, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = nixpkgs.lib.systems.flakeExposed;
      imports = [ inputs.devenv.flakeModule ];

      perSystem =
        { pkgs, ... }:
        {
          devenv.shells.default = {
            languages.javascript = {
              enable = true;
              package = pkgs.nodejs_25;
              pnpm.enable = true;
              corepack.enable = false;
              lsp.enable = true;
            };

            packages = with pkgs; [
              git
              pnpm
              vtsls
              nodePackages.vscode-langservers-extracted
              oxlint
              oxfmt
              eslint
              marksman
              markdownlint
            ];

            tasks = {
              "quartz".exec = "node ./scripts/quartz-runner.mjs";
              "quartz:local".exec = "./_quartz-upstream/quartz/bootstrap-cli.mjs";
              "docs".exec = "pnpx quartz build --serve -d _quartz-upstream/docs";
              "build:vivere".exec = "pnpm run quartz -- build";
              "dev:vivere".exec = "pnpm run quartz -- build --serve";
              "sync:notes".exec = "node ./scripts/sync-obsidian-notes.mjs";
              "check".exec = "tsc --noEmit && npx prettier . --check";
              "format".exec = "pnpx prettier . --write";
              "test".exec = "tsx --test";
              "profile".exec = "0x -D prof ./_quartz-upstream/quartz/bootstrap-cli.mjs build --concurrency=1 -d ../.quartz-source-vivere/content";
            };

            scripts.pnpm.exec = ''
              repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
              exec ${pkgs.pnpm}/bin/pnpm "$@"
            '';

            processes.frontend = {
              exec = "pnpm dev:vivere";
            };

            enterShell = ''
              echo "Quartz pnpm workspace shell"
              node --version
              pnpm --version
              echo "LSPs in PATH: vtsls, vscode-json-language-server"
              echo "Run: devenv up (frontend dev server)"
              echo "Run: devenv tasks run format"
            '';
          };
        };
    };
}
