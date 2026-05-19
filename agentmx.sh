#!/bin/bash

# AgentMX Project Control Script
# Quick enable/disable AgentMX for current project

set -e

MARKER_FILE=".agentmx-enabled"
GITIGNORE_FILE=".gitignore"

show_help() {
  cat << EOF
AgentMX Project Control

Usage:
  ./agentmx.sh enable   - Enable AgentMX for this project
  ./agentmx.sh disable  - Disable AgentMX for this project
  ./agentmx.sh status   - Check if AgentMX is enabled
  ./agentmx.sh help     - Show this help message

Examples:
  # Enable AgentMX
  ./agentmx.sh enable

  # Check status
  ./agentmx.sh status

  # Disable AgentMX
  ./agentmx.sh disable

EOF
}

check_status() {
  if [ -f "$MARKER_FILE" ]; then
    echo "✓ AgentMX is ENABLED for this project"
    echo "  Marker file: $(pwd)/$MARKER_FILE"
    return 0
  else
    echo "✗ AgentMX is DISABLED for this project"
    echo "  Run './agentmx.sh enable' to enable"
    return 1
  fi
}

enable_agentmx() {
  if [ -f "$MARKER_FILE" ]; then
    echo "✓ AgentMX is already enabled"
    return 0
  fi

  # Create marker file
  touch "$MARKER_FILE"
  echo "✓ Created marker file: $MARKER_FILE"

  # Add to .gitignore if it exists
  if [ -f "$GITIGNORE_FILE" ]; then
    if ! grep -q "^\.agentmx-enabled$" "$GITIGNORE_FILE"; then
      echo "" >> "$GITIGNORE_FILE"
      echo "# AgentMX" >> "$GITIGNORE_FILE"
      echo ".agentmx-enabled" >> "$GITIGNORE_FILE"
      echo ".agentmx/" >> "$GITIGNORE_FILE"
      echo "✓ Added to .gitignore"
    else
      echo "✓ Already in .gitignore"
    fi
  else
    echo "⚠ No .gitignore found (consider creating one)"
  fi

  echo ""
  echo "🎉 AgentMX is now ENABLED for this project!"
  echo ""
  echo "Next steps:"
  echo "  1. Open this project in Claude Code"
  echo "  2. Claude will automatically use AgentMX tools"
  echo "  3. Check status: ./agentmx.sh status"
}

disable_agentmx() {
  if [ ! -f "$MARKER_FILE" ]; then
    echo "✓ AgentMX is already disabled"
    return 0
  fi

  # Remove marker file
  rm "$MARKER_FILE"
  echo "✓ Removed marker file: $MARKER_FILE"

  # Optionally remove .agentmx directory
  if [ -d ".agentmx" ]; then
    read -p "Remove .agentmx/ directory with all data? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      rm -rf ".agentmx"
      echo "✓ Removed .agentmx/ directory"
    else
      echo "✓ Kept .agentmx/ directory (data preserved)"
    fi
  fi

  echo ""
  echo "🔒 AgentMX is now DISABLED for this project"
}

# Main
case "${1:-help}" in
  enable)
    enable_agentmx
    ;;
  disable)
    disable_agentmx
    ;;
  status)
    check_status
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo "Error: Unknown command '$1'"
    echo ""
    show_help
    exit 1
    ;;
esac
