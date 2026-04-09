{ pkgs, ... }:

{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    npm.enable = true;
    pnpm.enable = true;
    corepack.enable = true;
    lsp.enable = true;
  };

  packages = with pkgs; [
    git
    jq
    shellcheck
    nodePackages_latest.bash-language-server
    nodePackages.typescript-language-server
    vtsls
    nodePackages.vscode-langservers-extracted
    marksman
    yaml-language-server
    nil
    nixd
    statix
    deadnix
    alejandra
  ];

  scripts.quartz.exec = "./quartz/bootstrap-cli.mjs";

  tasks = {
    "garden:sync-notes".exec = "npm run sync:notes";
    "garden:build".exec = "npm run build";
    "garden:dev".exec = "npm run dev";
    "garden:check".exec = "npm run check";
    "garden:format".exec = "npm run format";
    "garden:netlify-build".exec = "npm run build";
  };

  processes.frontend.exec = "npm run dev";

  enterShell = ''
    echo "Garden dev shell"
    node --version
    npm --version
    pnpm --version
    echo "LSPs in PATH: vtsls, typescript-language-server, vscode-{html,css,json,eslint}-language-server, marksman, yaml-language-server, nil, nixd"
    echo "Use .env for OBSIDIAN_SOURCE_* settings"
  '';
}
