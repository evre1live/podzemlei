#!/bin/sh
# Сборка настоящего кубика: npm i esbuild three@0.180.0 cannon-es@0.20.0 (в любой папке), затем
#   NODE_PATH=<та папка>/node_modules sh art/dice3d/build.sh
# Результат — public/vendor/dice3d-1.min.mjs (three.js и cannon-es — лицензия MIT, см. public/vendor/dice3d-LICENSE.txt).
cd "$(dirname "$0")/../.." || exit 1
"${ESBUILD:-npx esbuild}" art/dice3d/dice3d.js --bundle --format=esm --minify --target=es2020 --legal-comments=none --outfile=public/vendor/dice3d-1.min.mjs
