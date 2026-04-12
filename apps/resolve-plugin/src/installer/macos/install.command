#!/bin/bash
# PIECE Studio — macOS Installer
# Installs the plugin to the system-wide DaVinci Resolve plugins directory.
# Requires administrator privileges (sudo).

set -euo pipefail

PLUGIN_NAME="PIECE Studio"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_SOURCE_DIR="$SCRIPT_DIR"

# When running from source tree (src/installer/macos/), go up to plugin root
if [ ! -f "$PLUGIN_SOURCE_DIR/main.js" ]; then
  PLUGIN_SOURCE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi

# Resolve system-wide plugin directory (official path from Blackmagic docs)
RESOLVE_PLUGINS_DIR="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins"
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
if [ ! -f "$PLUGIN_SOURCE_DIR/main.js" ]; then
  echo "ERROR: main.js not found."
  echo "Please run 'pnpm run build' in the resolve-plugin directory first."
  exit 1
fi

if [ ! -f "$PLUGIN_SOURCE_DIR/preload.js" ]; then
  echo "ERROR: preload.js not found."
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

# Request admin privileges upfront (system-wide directory requires root)
echo "Administrator privileges required for system-wide installation."
sudo -v || { echo "ERROR: Administrator privileges required."; exit 1; }

# Create destination directory
echo "Installing to: $PLUGIN_DEST"
sudo mkdir -p "$PLUGIN_DEST/dist/renderer"

# Copy plugin files
sudo cp "$PLUGIN_SOURCE_DIR/manifest.xml" "$PLUGIN_DEST/manifest.xml"
sudo cp "$PLUGIN_SOURCE_DIR/main.js" "$PLUGIN_DEST/main.js"
sudo cp "$PLUGIN_SOURCE_DIR/preload.js" "$PLUGIN_DEST/preload.js"
sudo cp -R "$PLUGIN_SOURCE_DIR/dist/renderer/." "$PLUGIN_DEST/dist/renderer/"

# Find and copy WorkflowIntegration.node
NODE_MODULE_FOUND=false
for SAMPLE_PATH in "${SAMPLE_PLUGIN_PATHS[@]}"; do
  NODE_FILE="$SAMPLE_PATH/WorkflowIntegration.node"
  if [ -f "$NODE_FILE" ]; then
    echo "Found WorkflowIntegration.node at: $SAMPLE_PATH"
    sudo cp "$NODE_FILE" "$PLUGIN_DEST/WorkflowIntegration.node"
    NODE_MODULE_FOUND=true
    break
  fi
done

if [ "$NODE_MODULE_FOUND" = false ]; then
  # Check if already present in the plugin source
  if [ -f "$PLUGIN_SOURCE_DIR/WorkflowIntegration.node" ]; then
    sudo cp "$PLUGIN_SOURCE_DIR/WorkflowIntegration.node" "$PLUGIN_DEST/WorkflowIntegration.node"
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
sudo xattr -rd com.apple.quarantine "$PLUGIN_DEST" 2>/dev/null || true

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
