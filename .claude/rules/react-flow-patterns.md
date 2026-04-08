# React Flow Patterns

## Library

**@xyflow/react** (React Flow v12+). All flow editor code uses ES modules.

## Feature Module Structure

```
features/workflow/
  api/
    workflow-api.js           # CRUD operations (TanStack Query ready)
  hooks/
    use-flow-store.js         # Zustand store (nodes, edges, actions)
    use-undo-redo.js          # Undo/redo with keyboard shortcuts
    use-copy-paste.js         # Copy/cut/paste with keyboard shortcuts
    use-drag-and-drop.js      # Drag from sidebar to canvas
    use-auto-layout.js        # ELK-based auto-layout
  components/
    flow-editor/
      FlowEditor.jsx          # Main ReactFlow wrapper
      FlowToolbar.jsx          # Toolbar (undo, redo, layout)
      FlowSidebar.jsx          # Draggable node types sidebar
    nodes/
      BaseNode.jsx             # Default node component (Radix UI styled)
      index.js                 # nodeTypes registry + createNodeByType()
    edges/
      BaseEdge.jsx             # Default edge component
      index.js                 # edgeTypes registry + createEdge()
  constants/
    node-config.js             # Node type definitions (handles, icons)
  pages/
    WorkflowEditorPage.jsx     # Page with ReactFlowProvider + FlowEditor
  index.js                     # Public API
```

## State Management

Flow state lives in **Zustand** (via `createFlowStore()`), NOT in TanStack Query.

TanStack Query is used only for **server persistence** (save/load workflows via API).

```javascript
// Zustand for local flow state
const store = useMemo(() => createFlowStore({ nodes, edges }), []);

// TanStack Query for server data
const { data: workflow } = useQuery({
  queryKey: ['workflow', workflowId],
  queryFn: () => workflowApi.getById(workflowId),
});
```

## Node Type Configuration

All node types are defined in `constants/node-config.js`. Each type specifies:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique type identifier |
| `title` | string | Display name (used as i18n fallback) |
| `handles` | array | Connection points (type, position, optional id) |
| `icon` | string | Lucide icon name |

Adding a new node type requires only editing `node-config.js`.

## Keyboard Shortcuts

| Shortcut | Action | Hook |
|----------|--------|------|
| Cmd/Ctrl+Z | Undo | `useUndoRedo()` |
| Cmd/Ctrl+Shift+Z | Redo | `useUndoRedo()` |
| Cmd/Ctrl+C | Copy | `useCopyPaste()` |
| Cmd/Ctrl+V | Paste | `useCopyPaste()` |
| Cmd/Ctrl+X | Cut | `useCopyPaste()` |

## ReactFlowProvider

Every page that uses React Flow MUST be wrapped in `<ReactFlowProvider>`.

```javascript
import { ReactFlowProvider } from '@xyflow/react';

export function WorkflowPage() {
  return (
    <ReactFlowProvider>
      <FlowEditor store={store} />
    </ReactFlowProvider>
  );
}
```

## Layout Algorithms

| Algorithm | Library | Best For | Direction |
|-----------|---------|----------|-----------|
| ELK Layered | `elkjs` | Workflows, DAGs | DOWN, RIGHT |
| Dagre | `@dagrejs/dagre` | Simple DAGs | TB, LR |
| D3 Force | `d3-force` | Network diagrams | Physics-based |
| D3 Hierarchy | `d3-hierarchy` | Tree structures | TB |

Default scaffold uses **ELK** (via `use-auto-layout.js`).

## Shared FlowContainer

For simple read-only or lightweight flow displays, use `FlowContainer` from shared components:

```javascript
import { FlowContainer } from '@/shared/components';

function FlowPreview({ nodes, edges }) {
  return (
    <FlowContainer nodes={nodes} edges={edges} />
  );
}
```

For full editing, use the workflow feature module's `FlowEditor`.

## i18n

All UI text in flow editor components uses `useTranslation('workflow')`.

Namespace file: `locales/{lang}/workflow.json`.

## Anti-patterns

- **NEVER** manage flow nodes/edges in TanStack Query -- use Zustand store
- **NEVER** create ReactFlow without `<ReactFlowProvider>` wrapper
- **NEVER** define node types inline -- use `node-config.js` registry
- **NEVER** import `@xyflow/react/dist/style.css` in multiple places -- import once in FlowEditor
- **NEVER** use `useEffect` + manual state for undo/redo -- use `useUndoRedo()` hook
- **NEVER** hardcode node type strings -- reference `nodesConfig` keys
- **NEVER** skip `takeSnapshot()` before state-changing operations (for undo/redo support)
- **NEVER** create `new ELK()` instances per render -- layout functions handle this internally

## Reference Examples

Pro examples are available at `docs/reference/react-flow-pro/` organized by category:

| Category | Location | Key Files |
|----------|----------|-----------|
| Workflow editors | `workflow-editors/` | Full Next.js apps with store, layout, custom nodes |
| Reusable hooks | `hooks/` | useUndoRedo, useCopyPaste, useForceLayout, useAutoLayout, useHelperLines |
| Custom components | `components/` | EditableEdge (4 path types), Shapes (SVG), Expand/Collapse |
| Feature examples | `features/` | Collaborative (Yjs), Freehand draw, Animations |
