#!/bin/sh
# Adds two Mixamo girls (With Skin, walking) to the Live World.
#   sh scripts/add-girls.sh ~/Downloads/Walking.fbx "$HOME/Downloads/Walking (1).fbx"
# Needs internet once (to fetch the FBX converter) and Pillow (pip install pillow).
set -e
[ -n "$1" ] || { echo "Usage: sh scripts/add-girls.sh girl1.fbx [girl2.fbx]"; exit 1; }
node scripts/convert-fbx.js "$1" public/media/models/woman.glb
[ -z "$2" ] || node scripts/convert-fbx.js "$2" public/media/models/woman2.glb
python3 scripts/shrink-glb.py public/media/models/woman.glb $( [ -z "$2" ] || echo public/media/models/woman2.glb )
echo "Done. Restart the server and press Ctrl+Shift+R in the browser."
