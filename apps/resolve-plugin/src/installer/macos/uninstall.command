#!/bin/bash
# PIECE Studio — macOS Uninstaller
# Removes the plugin from the per-user DaVinci Resolve plugins directory.
# No sudo required.

set -euo pipefail

PLUGIN_NAME="PIECE Studio"
RESOLVE_PLUGINS_DIR="$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins"
PLUGIN_DEST="$RESOLVE_PLUGINS_DIR/$PLUGIN_NAME"

echo "========================================="
echo "  PIECE Studio — Uninstaller"
echo "========================================="
echo ""

if [ ! -d "$PLUGIN_DEST" ]; then
  echo "Plugin not found at: $PLUGIN_DEST"
  echo "Nothing to uninstall."
  exit 0
fi

echo "Removing: $PLUGIN_DEST"
rm -rf "$PLUGIN_DEST"

echo ""
echo "========================================="
echo "  Uninstall complete!"
echo "========================================="
echo ""
echo "Restart DaVinci Resolve for changes to take effect."
echo ""

exit 0
