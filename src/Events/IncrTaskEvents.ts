import { TFile, Events as ObsidianEvents, WorkspaceLeaf, EventRef, Editor, Workspace, MarkdownView, MarkdownFileInfo } from "obsidian";
import { logging } from "../lib/logging";

export class IncrTaskEvents {
  private obsidianEvents: ObsidianEvents;
  private currentActiveLeaf: WorkspaceLeaf | null;
  private currentFilename: string;
  private workspace:Workspace;
  logger = logging.getLogger("tasks.Events");

  constructor({ obsidianEvents, workspace }: { obsidianEvents: ObsidianEvents, workspace:Workspace }) {
    this.obsidianEvents = obsidianEvents;
    this.workspace = workspace;
  }

  onLayoutChange(callback: () => void): EventRef {
    return this.obsidianEvents.on("layout-change", () => {
      console.log("IncrTaskEvents.onLayoutChange()");
      callback();
    });
  }

  // Subscribe to events with type-safe callbacks
  onFileOpen(callback: (file: TFile) => void): EventRef {
    
    return this.obsidianEvents.on("file-open",(file: TFile) => {
      console.log("IncrTaskEvents.onFileOpen()", file.path);
      callback(file);
    });
  }

  onEditorChange(callback: (editor: Editor) => void): EventRef {
    
    return this.obsidianEvents.on("editor-change",  (editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
      console.log("IncrTaskEvents.onEditorChange()", info);
      if (info instanceof MarkdownView) {        
        callback(editor);
      }
    });
  }

  onActiveLeafChange(callback: (leaf: WorkspaceLeaf) => void): EventRef {
    

    return this.obsidianEvents.on("active-leaf-change", (leaf:WorkspaceLeaf, ctx) => {
      // console.log("IncrTaskEvents.onActiveLeafChange()");
      // const a = leaf !== this.currentActiveLeaf;
      // //const b = leaf.view instanceof MarkdownView;
      // console.log("new leaf:", a);
      // //console.log("md view:", b);
      // console.log("view", leaf.view.getViewType(), leaf.getViewState());	
      // console.log("ctx", ctx);

      if (this.currentActiveLeaf !== leaf) {
        this.currentActiveLeaf = leaf;
        const state = leaf.getViewState().state;
        if (state?.file && this.currentFilename != state.file) {
          this.currentFilename = state?.file as string;
          callback(leaf);
        }
      }
      // if (a) {
      //   this.currentActiveLeaf = leaf;
      //   callback(leaf);
      // }
    });
  }

  // Emit custom events specific to your plugin
  onTaskUpdate(callback: (taskId: string) => void): EventRef {
    console.log("IncrTaskEvents.onTaskUpdate()");
    return this.obsidianEvents.on("incrtask-update", callback);
  }

  public off(eventRef: EventRef): void {
    console.log("TasksEvents.off()");
    this.obsidianEvents.offref(eventRef);
  }
}
