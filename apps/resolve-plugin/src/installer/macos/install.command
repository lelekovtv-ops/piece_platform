#!/bin/bash
# PIECE Studio — macOS Installer
# Installs the plugin to the per-user DaVinci Resolve plugins directory.
# No sudo required.

set -euo pipefail

PLUGIN_NAME="PIECE Studio"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve per-user plugin directory
RESOLVE_PLUGINS_DIR="$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins"
PLUGIN_DEST="$RESOLVE_PLUGINS_DIR/$PLUGIN_NAME"

# WorkflowIntegration.node search paths
SAMPLE_PLUGIN_PATHS=(
  "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Workflow Integrations/Examples/SamplePlugin"
  "$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Workflow Integrations/Examples/SamplePlugin"
)

echo "========================================="
echo "  PIECE Studio — Installer"
echo "========================================="
echo ""

# Check source files exist
if [ ! -f "$PLUGIN_SOURCE_DIR/dist/main/index.cjs" ]; then
  echo "ERROR: dist/main/index.cjs not found."
  echo "Please run 'pnpm run build' in the resolve-plugin directory first."
  exit 1
fi

if [ ! -f "$PLUGIN_SOURCE_DIR/manifest.xml" ]; then
  echo "ERROR: manifest.xml not found."
  exit 1
fi

if [ ! -d "$PLUGIN_SOURCE_DIR/dist/renderer" ]; then
  echo "ERROR: dist/renderer/ directory not found."
  exit 1
fi

# Create destination directory
echo "Installing to: $PLUGIN_DEST"
mkdir -p "$PLUGIN_DEST/dist/main"
mkdir -p "$PLUGIN_DEST/dist/renderer"

# Copy plugin files
cp "$PLUGIN_SOURCE_DIR/manifest.xml" "$PLUGIN_DEST/manifest.xml"
cp "$PLUGIN_SOURCE_DIR/dist/main/index.cjs" "$PLUGIN_DEST/dist/main/index.cjs"
cp -R "$PLUGIN_SOURCE_DIR/dist/renderer/." "$PLUGIN_DEST/dist/renderer/"

# Find and copy WorkflowIntegration.node
NODE_MODULE_FOUND=false
for SAMPLE_PATH in "${SAMPLE_PLUGIN_PATHS[@]}"; do
  NODE_FILE="$SAMPLE_PATH/WorkflowIntegration.node"
  if [ -f "$NODE_FILE" ]; then
    echo "Found WorkflowIntegration.node at: $SAMPLE_PATH"
    cp "$NODE_FILE" "$PLUGIN_DEST/WorkflowIntegration.node"
    NODE_MODULE_FOUND=true
    break
  fi
done

if [ "$NODE_MODULE_FOUND" = false ]; then
  # Check if already present in the plugin source
  if [ -f "$PLUGIN_SOURCE_DIR/WorkflowIntegration.node" ]; then
    cp "$PLUGIN_SOURCE_DIR/WorkflowIntegration.node" "$PLUGIN_DEST/WorkflowIntegration.node"
    NODE_MODULE_FOUND=true
  fi
fi

if [ "$NODE_MODULE_FOUND" = false ]; then
  echo ""
  echo "WARNING: WorkflowIntegration.node not found."
  echo "The plugin will NOT work without it."
  echo ""
  echo "Please install the DaVinci Resolve Workflow Integration SDK,"
  echo "then copy WorkflowIntegration.node to:"
  echo "  $PLUGIN_DEST/WorkflowIntegration.node"
  echo ""
fi

# Remove macOS quarantine attributes
xattr -rd com.apple.quarantine "$PLUGIN_DEST" 2>/dev/null || true

echo ""
echo "========================================="
echo "  Installation complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Open (or restart) DaVinci Resolve Studio"
echo "  2. Go to Workspace > Workflow Integrations"
echo "  3. Select '$PLUGIN_NAME'"
echo ""

exit 0
