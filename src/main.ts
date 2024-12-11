import { MarkdownView, Plugin, TFile } from "obsidian";

import { IncrTask } from "./IncrTask/IncrTask";
import { Cache } from "./Obsidian/Cache";
// import { Commands } from "./Commands";
import { IncrTaskEvents } from "./Events/IncrTaskEvents";
import { initializeDependencies } from "./Obsidian/File";
//import { InlineRenderer } from "./Obsidian/InlineRenderer";
//import { QueryRenderer } from "./Renderer/QueryRenderer";
import { getSettings, updateSettings } from "./Config/Settings";
import { IncrementalTaskSettingTab } from "./Config/Settings";
import { log, logging } from "./lib/logging";
import { TaskService } from "./IncrTask/TaskService";

import { EditorView, ViewPlugin } from "@codemirror/view";
import { newEditorContentHandler } from "./Obsidian/EditorContentHandler";
import { TasksEvents } from "./Events/TaskEvents";

export default class TasksPlugin extends Plugin {
  private static cache: Cache | undefined;
  // public inlineRenderer: InlineRenderer | undefined;
  // public queryRenderer: QueryRenderer | undefined;
  private taskService: TaskService;
  lastOpenedFile: TFile | null = null;

  async onload() {
    this.registerEditorExtension(newEditorContentHandler());

    // // Handle initial load and file opens
    // this.registerEvent(this.app.workspace.on("file-open", (file: TFile) => this.handleFileOpen(file)));

    // // Handle layout changes (split screens, new tabs)
    // this.registerEvent(this.app.workspace.on("layout-change", () => this.handleLayoutChange()));

    // // Handle initial files in view
    // this.handleInitialLoad();

    logging.registerConsoleLogger();
    log("info", `loading plugin "${this.manifest.name}" v${this.manifest.version}`);

    await this.loadSettings();

    // Configure logging.
    const { loggingOptions } = getSettings();
    logging.configure(loggingOptions);

    this.addSettingTab(new IncrementalTaskSettingTab({ plugin: this }));

    // initializeDependencies({
    //   app: this.app,
    //   metadataCache: this.app.metadataCache,
    //   workspace: this.app.workspace,
    // });
    const tevents = new TasksEvents({obsidianEvents: this.app.workspace});
    const events = new IncrTaskEvents({ obsidianEvents: this.app.workspace, workspace: this.app.workspace });
    TasksPlugin.cache = new Cache({
      metadataCache: this.app.metadataCache,
      workspace: this.app.workspace,
      tevents,
      events,
      vault: this.app.vault,
    });
    // // this.inlineRenderer = new InlineRenderer({ plugin: this });
    // // this.queryRenderer = new QueryRenderer({ plugin: this, events });

    // const newECH = newEditorContentHandler();
    // newECH.setCache(this.cache);
    // this.registerEditorExtension(newECH);

    // this.taskService = new TaskService(this.cache);
    // IncrTask.setTaskService(this.taskService);
  }

  onunload() {
    log("info", `unloading plugin "${this.manifest.name}" v${this.manifest.version}`);
    TasksPlugin.cache?.unload();
  }

  static getCache(): Cache | undefined {
    return TasksPlugin.cache;
  }

  private handleFileOpen(file: TFile) {
    if (file && file.extension === "md") {
      console.log("File opened:", file.path);
      this.lastOpenedFile = file;
      // const ed = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
      // console.log(ed?.getLine(1));
      // console.log(ed?.getLine(2));
      // console.log(ed?.getLine(3));
      //this.app.workspace.getActiveViewOfType(MarkdownView)?.editor.getLine(2);
    }
  }

  private handleLayoutChange() {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        const file = view.file;
        if (file) {
          console.log("File in view:", file.path);
          // Add your event handlers for this file here
        }
      }
    });
  }

  private handleInitialLoad() {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        const file = view.file;
        if (file) {
          console.log("Initial file in view:", file.path);
          // Add your event handlers for this file here
        }
      }
    });
  }

  async loadSettings() {
    let newSettings = await this.loadData();
    updateSettings(newSettings);

    // Fetch the updated settings, in case the user has not yet edited the settings,
    // in which case newSettings is currently empty.
    newSettings = getSettings();
    // GlobalFilter.getInstance().set(newSettings.globalFilter);
    // GlobalFilter.getInstance().setRemoveGlobalFilter(newSettings.removeGlobalFilter);
    // GlobalQuery.getInstance().set(newSettings.globalQuery);
  }

  async saveSettings() {
    await this.saveData(getSettings());
  }

  // public getTasks(): IncrTask[] {
  //   if (this.cache === undefined) {
  //     return [] as IncrTask[];
  //   } else {
  //     return this.cache.getTasks();
  //   }
  // }
}
