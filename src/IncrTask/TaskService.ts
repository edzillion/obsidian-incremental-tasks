import { Editor, MarkdownView, WorkspaceLeaf } from "obsidian";
import { IncrTask } from "./IncrTask";
import { logging } from "src/lib/logging";
import { logEndOfTaskEdit, logStartOfTaskEdit } from "src/lib/LogTasksHelper";

export class TaskService {
  private cache: any;
  private tasksApi: any;
  private editor: Editor;

  constructor(cache: any) {
    
    this.tasksApi = cache.metadataCache.app.plugins.plugins["obsidian-tasks-plugin"].apiV1;
    this.cache = cache;
    //this.setupEditor()
    // if (!editor) throw Error("editor is null");
  }

  private setupEditor() {
    // this.cache.events.onActiveLeafChange((leaf:WorkspaceLeaf) => {
    //   if (leaf.view instanceof MarkdownView) {
    //     console.log('editor loaded');
    //     this.editor = leaf.view.editor;
    //   }
    // });

    // // Get initial editor if available
    // const activeView = this.cache.workspace.getActiveViewOfType(MarkdownView);
    // if (activeView) {
    //   this.editor = activeView.editor;
    // }
    // else console.log("editor miss");
  }

  public toggle(task: IncrTask): IncrTask[] {
    const logger = logging.getLogger("TaskService.toggleTask()");
    const codeLocation = "toggle()";
    logStartOfTaskEdit(logger, codeLocation, task);

    const activeFile = this.cache.workspace.getActiveFile();
    if (!activeFile) throw Error("getActiveFile() returned nothing");

    const taskLine = this.editor.getLine(task.range.from.line);
    let newTaskLine = this.tasksApi.executeToggleTaskDoneCommand(taskLine, activeFile.path);
    this.editor.replaceRange(newTaskLine, task.range.from, task.range.to);
    task.checked = !task.checked;

    logEndOfTaskEdit(logger, codeLocation, [task]);
    return [task];
  }
}
