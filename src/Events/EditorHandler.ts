export class EditorHandler {
  constructor(private taskService: TaskService) {}

  onChange = (editor: Editor) => {
    // Handle editor changes
    this.taskService.updateTasks(editor);
  };

  onActiveLeafChange = (leaf: WorkspaceLeaf) => {
    // Handle active file changes
    this.taskService.loadTasksForFile(leaf);
  };
}
