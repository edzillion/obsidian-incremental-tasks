import { MarkdownView, MetadataCache, Notice, TAbstractFile, TFile, Vault } from "obsidian";
import type { CachedMetadata, Editor, EditorRange, EventRef, ListItemCache, SectionCache, Workspace, WorkspaceLeaf } from "obsidian";
import { Mutex } from "async-mutex";
import { IncrTask } from "../IncrTask/IncrTask";
import { getSettings } from "../Config/Settings";
import { Logger, logging } from "../lib/logging";
import type { IncrTaskEvents } from "../Events/IncrTaskEvents";
import type { TasksEvents, CacheUpdateData } from "../Events/TaskEvents";
import TasksPlugin from "src/main";
import { ListItem } from "src/IncrTask/ListItem";
import { TaskLocation } from "src/IncrTask/TaskLocation";

export enum State {
  Cold = "Cold",
  Initializing = "Initializing",
  Warm = "Warm",
}

// export function getTasksFromEditorContent(
//   editor: Editor,
//   errorReporter: (e: any, lineNum: number, line: string) => void,
//   logger: Logger
// ): IncrTask[] {
//   const tasks: IncrTask[] = [];

//   console.log(editor.getLine(1));
//   console.log(editor.getLine(2));

//   if (!editor.getValue().contains(getSettings().incrementalTaskTag)) return tasks;

//   const editorLines = editor.getValue().split("\n");
//   for (let lineNum = 0; lineNum < editorLines.length; lineNum++) {
//     const line = editorLines[lineNum];
//     if (!line.contains(getSettings().incrementalTaskTag)) continue;

//     let task;
//     let range: EditorRange = { from: { ch: 0, line: lineNum }, to: { ch: line.length, line: lineNum } };
//     try {
//       task = IncrTask.fromLine({
//         line,
//         range,
//       });

//       // if (task !== null) {
//       //   // listItem.parent could be negative if the parent is not found (in other words, it is a root task).
//       //   // That is not a problem, as we never put a negative number in line2ListItem map, so parent will be null.
//       //   const parentListItem: ListItem | null = line2ListItem.get(listItem.parent) ?? null;
//       //   if (parentListItem !== null) {
//       //     task = new IncrTask({
//       //       ...task,
//       //       parent: parentListItem,
//       //     });
//       //   }

//       //   line2ListItem.set(lineNumber, task);
//       // }
//     } catch (e) {
//       //throw Error(e);
//       errorReporter(e, lineNum, line);
//       continue;
//     }

//     if (task !== null) {
//       tasks.push(task);
//     }

//     //const task = this.getTaskFromLine(line, i) as IncrementalTask;
//   }
//   return tasks;
// }


export function getTasksFromFileContent3(
  filePath: string,
  fileContent: string,
  listItems: ListItemCache[] | undefined,
  logger: Logger,
  fileCache: CachedMetadata,
  errorReporter: (e: any, filePath: string, listItem: ListItemCache, line: string) => void
) {
  const tasks: IncrTask[] = [];
  if (listItems === undefined) {
    // When called via Cache, this function would never be called or files without list items.
    // It is useful for tests to be act gracefully on sample Markdown files with no list items, however.
    return tasks;
  }

  // const tasksFile = new TasksFile(filePath, fileCache);
  const fileLines = fileContent.split("\n");
  const linesInFile = fileLines.length;

  // Lazily store date extracted from filename to avoid parsing more than needed
  // this.logger.debug(`getTasksFromFileContent() reading ${file.path}`);
  // const dateFromFileName = new Lazy(() => DateFallback.fromPath(filePath));

  // We want to store section information with every task so
  // that we can use that when we post process the markdown
  // rendered lists.
  let currentSection: SectionCache | null = null;
  let sectionIndex = 0;
  const line2ListItem: Map<number, ListItem> = new Map();
  for (const listItem of listItems) {
    const lineNumber = listItem.position.start.line;
    if (lineNumber >= linesInFile) {
      /*
                Obsidian CachedMetadata has told us that there is a task on lineNumber, but there are
                not that many lines in the file.

                This was the underlying cause of all the 'Stuck on "Loading Tasks..."' messages,
                as it resulted in the line 'undefined' being parsed.

                Somehow the file had been shortened whilst Obsidian was closed, meaning that
                when Obsidian started up, it got the new file content, but still had the old cached
                data about locations of list items in the file.
             */
      logger.debug(
        `${filePath} Obsidian gave us a line number ${lineNumber} past the end of the file. ${linesInFile}.`
      );
      return tasks;
    }
    if (currentSection === null || currentSection.position.end.line < lineNumber) {
      // We went past the current section (or this is the first task).
      // Find the section that is relevant for this task and the following of the same section.
      currentSection = Cache.getSection(lineNumber, fileCache.sections);
      sectionIndex = 0;
    }

    if (currentSection === null) {
      // Cannot process a task without a section.
      continue;
    }

    const line = fileLines[lineNumber];
    if (line === undefined) {
      logger.debug(`${filePath}: line ${lineNumber} - ignoring 'undefined' line.`);
      continue;
    }

    if (listItem.task !== undefined) {
      let task;
      try {
        task = IncrTask.fromLine({
          line,
          taskLocation: new TaskLocation(
            filePath,
            lineNumber,
            currentSection.position.start.line,
            sectionIndex
          )
        });

        if (task !== null) {
          // listItem.parent could be negative if the parent is not found (in other words, it is a root task).
          // That is not a problem, as we never put a negative number in line2ListItem map, so parent will be null.
          const parentListItem: ListItem | null = line2ListItem.get(listItem.parent) ?? null;
          if (parentListItem !== null) {
            task = IncrTask.create(              
              {
              ...task,
              parent: parentListItem,
            });
          }

          line2ListItem.set(lineNumber, task);
        }
      } catch (e) {
        errorReporter(e, filePath, listItem, line);
        continue;
      }

      if (task !== null) {
        sectionIndex++;
        tasks.push(task);
      }
    } else {
      const lineNumber = listItem.position.start.line;

      const parentListItem: ListItem | null = line2ListItem.get(listItem.parent) ?? null;

      line2ListItem.set(lineNumber, new ListItem(fileLines[lineNumber], parentListItem));
    }
  }

  return tasks;
}


export class Cache {
  logger = logging.getLogger("tasks.Cache");

  private readonly metadataCache: MetadataCache;
  private readonly events: IncrTaskEvents;
  private readonly eventsEventReferences: EventRef[];
  private readonly workspace: Workspace;
  private readonly tasksMutex: Mutex;
  private state: State;
  private tasks: IncrTask[];

  private listeners: ((tasks: IncrTask[]) => void)[] = [];

  private lastOpenedFile: TFile | null = null;
  tevents: TasksEvents;
  vault: Vault;

  constructor({
    metadataCache,
    events,
    tevents,
    workspace,
    vault,
  }: {
    metadataCache: MetadataCache;
    events: IncrTaskEvents;
    tevents: TasksEvents;
    workspace: Workspace;
    vault: Vault;
  }) {
    this.logger.debug("Creating Cache object");

    this.metadataCache = metadataCache;
    this.events = events;
    this.tevents = tevents;
    this.vault = vault;
    this.eventsEventReferences = [];
    this.workspace = workspace;
    this.tasksMutex = new Mutex();
    this.state = State.Cold;
    this.logger.debug("Cache.constructor(): state = Cold");

    this.tasks = [];

    this.registerEventHandlers();
  }

  public unload(): void {
    this.logger.info("Unloading Cache");

    for (const eventReference of this.eventsEventReferences) {
      this.events.off(eventReference);
    }
  }

  public getTasks(): IncrTask[] {
    return this.tasks;
  }

  public getState(): State {
    return this.state;
  }

  public static getSection(lineNumberTask: number, sections: SectionCache[] | undefined): SectionCache | null {
    if (sections === undefined) {
      return null;
    }

    for (const section of sections) {
      if (section.position.start.line <= lineNumberTask && section.position.end.line >= lineNumberTask) {
        return section;
      }
    }

    return null;
  }

  addListener(callback: (tasks: IncrTask[]) => void) {
    this.logger.debug("Cache.addListener()");
    this.listeners.push(callback);
  }

  private notifyListeners(tasks: IncrTask[]) {
    this.logger.debug("Cache.notifyListeners()");
    this.listeners.forEach((listener) => listener(tasks));
  }

  private async indexFile(file: TFile): Promise<void> {
    const fileCache = this.metadataCache.getFileCache(file);
    if (fileCache === null || fileCache === undefined) {
      return;
    }

    if (!file.path.endsWith(".md")) {
      this.logger.debug("indexFile: skipping non-markdown file: " + file.path);
      return;
    }

    this.logger.debug("Cache.indexFile: " + file.path);

    const oldTasks = this.tasks.filter((task: IncrTask) => {
      return task.path === file.path;
    });

    const listItems = fileCache.listItems;
    // When there is no list items cache, there are no tasks.
    // Still continue to notify watchers of removal.

    let newTasks: IncrTask[] = [];
    if (listItems !== undefined) {
      // Only read the file and process for tasks if there are list items.
      const fileContent = await this.vault.cachedRead(file);
      newTasks = this.getTasksFromFileContent(
        fileContent,
        listItems,
        fileCache,
        file.path,
        this.reportTaskParsingErrorToUser,
        this.logger
      );
    }

    // If there are no changes in any of the tasks, there's
    // nothing to do, so just return.
    if (ListItem.listsAreIdentical(oldTasks, newTasks)) {
      // This code kept for now, to allow for debugging during development.
      // It is too verbose to release to users.
      // if (this.getState() == State.Warm) {
      //     this.logger.debug(`Tasks unchanged in ${file.path}`);
      // }
      return;
    }

    // Temporary edit - See https://github.com/obsidian-tasks-group/obsidian-tasks/issues/2160
    /*
        if (this.getState() == State.Warm) {
            // this.logger.debug(`Cache read: ${file.path}`);
            this.logger.debug(
                `At least one task, its line number or its heading has changed in ${file.path}: triggering a refresh of all active Tasks blocks in Live Preview and Reading mode views.`,
            );
        }
        */

    // Remove all tasks from this file from the cache before
    // adding the ones that are currently in the file.
    this.tasks = this.tasks.filter((task: IncrTask) => {
      return task.path !== file.path;
    });

    this.tasks.push(...newTasks);
    this.logger.debug("Cache.indexFile: " + file.path + `: read ${newTasks.length} task(s)`);

    // All updated, inform our subscribers.
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.logger.debug("Cache.notifySubscribers()");
    this.tevents.triggerCacheUpdate({
      tasks: this.tasks,
      state: this.state,
    });
  }

  private getTasksFromFileContent(
    fileContent: string,
    listItems: ListItemCache[],
    fileCache: CachedMetadata,
    filePath: string,
    errorReporter: (e: any, filePath: string, listItem: ListItemCache, line: string) => void,
    logger: Logger
  ): IncrTask[] {
    return getTasksFromFileContent3(filePath, fileContent, listItems, logger, fileCache, errorReporter);
  }

  private registerEventHandlers() {
    this.logger.debug("Cache.registerEventHandlers()");
    // const openReference = this.events.onFileOpen((file) => {
    //   const view = this.workspace.getActiveViewOfType(MarkdownView);
    //   if (view) {
    //     this.indexCurrentFile(view.editor, file);
    //   }
    // });
    // this.eventsEventReferences.push(openReference);

    // Handle editor changes directly
    // const fileOpenReference = this.events.onFileOpen((file:TFile) => {
    //   console.log("fileOpenReference", file.path);
    //   if (this.workspace) {
    //     const editor = this.workspace.getActiveViewOfType(MarkdownView)?.editor;
    //     if (editor)
    //       //this.workspace.onLayoutReady(() => {
    //         this.indexActiveEditor(editor);
    //       //})
    //   }
    // });
    // this.eventsEventReferences.push(fileOpenReference);

    // Handle editor changes directly
    // const editorChangeReference = this.events.onEditorChange(async (editor) => {
    //   console.log("editorChangeReference", editor.getLine(1));
    //   //await this.indexActiveEditor(editor);
    // });
    // this.eventsEventReferences.push(editorChangeReference);

    // const leafChangeReference = this.events.onActiveLeafChange((leaf) => {
    //   console.log("leafChangeReference", leaf.view.getViewType());
    //   if (leaf.view instanceof MarkdownView) {
    //     //this.indexActiveEditor(leaf.view.editor);
    //   }
    // });
    // this.eventsEventReferences.push(leafChangeReference);

    // const fileOpenRef = this.events.onFileOpen((file: TFile) => {
    //   console.log("onFileOpen");
    //   this.lastOpenedFile = file;
    // });
    // this.eventsEventReferences.push(fileOpenRef);

    // Listen for file-open event to track the last opened file

    // Register vault and workspace event handlers
    // this.vault.on("modify", (file: TFile) => {
    //   this.tevents.triggerRequestCacheUpdate((cacheData: CacheUpdateData) => {
    //     // Handle the cache update for this file
    //     console.log("modify", file.path);
    //     this.updateCacheForFile(file, cacheData);
    //   });
    // });

    this.workspace.on("active-leaf-change", (leaf) => {
      if (leaf?.view instanceof MarkdownView) {
        const container = leaf?.view.containerEl.querySelector(".view-content");
        if (container) {
          const file = leaf.view.file;
          if (file) {
            this.tevents.triggerRequestCacheUpdate((cacheData: CacheUpdateData) => {
              console.log("active-leaf-change", file.path);
              // Handle the cache update for the active file
              this.updateCacheForFile(file, cacheData);
            });
          }
        }
      }

      // if (leaf?.view instanceof MarkdownView && leaf.view.getViewType() === "markdown") {
      //   const file = leaf.view.file;
      //   if (file) {
      //     this.tevents.triggerRequestCacheUpdate((cacheData: CacheUpdateData) => {
      //       console.log("active-leaf-change", file.path);
      //       // Handle the cache update for the active file
      //       this.updateCacheForFile(file, cacheData);
      //     });
      //   }
      // }
    });

    this.workspace.on("editor-change", (editor) => {
      const file = this.workspace.getActiveFile();
      if (file) {
        this.tevents.triggerRequestCacheUpdate((cacheData: CacheUpdateData) => {
          console.log("editor-change", file.path);
          // Handle the cache update for the active file
          this.updateCacheForFile(file, cacheData);
        });
      }
    });

    // Register cache event handlers
    //this.tevents.onRequestCacheUpdate(this.handleCacheUpdate);
    this.tevents.onCacheUpdate(this.handleCacheUpdated);

    // Listen for layout changes to handle split screens and new tabs
    // const layoutChangeRef =  this.events.onLayoutChange(() => {
    //   const leaves = this.workspace.getLeavesOfType("markdown");
    //   leaves.forEach((leaf: WorkspaceLeaf) => {
    //     const view = leaf.view;
    //     if (view instanceof MarkdownView) {
    //       const file = view.file;
    //       if (file && file !== this.lastOpenedFile) {
    //         console.log("onLayoutChange");
    //         this.lastOpenedFile = file;
    //         const ed = this.workspace.activeEditor;
    //         if (ed && ed.editor) {
    //           this.indexActiveEditor(ed.editor);
    //           debugger;
    //         }

    //         // const tasks = getTasksFromEditorContent(this.view.state.doc.toString());
    //         // if (tasks.length > 0) {
    //         //   this.attachHandlers(this.view);
    //         // }
    //         // this.fileLoadedProcessed = false;
    //       }
    //     }
    //   });
    // });
    // this.eventsEventReferences.push(layoutChangeRef);
  }

  private updateCacheForFile(file: TFile, cacheData: CacheUpdateData) {
    console.log("updateCacheForFile", file.path);
  }

  private handleCacheUpdate = (updateFn: (cacheData: CacheUpdateData) => void) => {
    const cacheData: CacheUpdateData = {
      tasks: this.tasks,
      state: this.state,
    };
    console.log("handleCacheUpdate", cacheData);
    updateFn(cacheData);
  };

  private handleCacheUpdated = () => {
    // Handle when cache has been updated
  };

  // public async indexActiveEditor(editor: Editor) {
  //   this.logger.debug("Cache.indexActiveEditor");
  //   await this.tasksMutex.runExclusive(() => {
  //     const tasks = getTasksFromEditorContent(editor, this.reportTaskParsingErrorToUser, this.logger);
  //     this.updateTaskCache(tasks);
  //     this.notifyListeners(tasks);
  //   });
  // }

  private updateTaskCache(newTasks: IncrTask[]) {
    this.logger.debug("Cache.updateTaskCache: newTasks.length = " + newTasks.length);
    this.tasks.push(...newTasks);
  }

  private reportTaskParsingErrorToUser(e: any, filePath: string, listItem: ListItemCache, line: string) {
    const msg = `There was an error reading one of the tasks in this vault.
The following task has been ignored, to prevent Tasks queries getting stuck with 'Loading Tasks ...'
Error: ${e}      
File: ${filePath}
Line number: ${listItem.position.start.line}
IncrTask line: ${line}

Please create a bug report for this message at
https://github.com/obsidian-tasks-group/obsidian-tasks/issues/new/choose
to help us find and fix the underlying issue.

Include:
- either a screenshot of the error popup, or copy the text from the console, if on a desktop machine.
- the output from running the Obsidian command 'Show debug info'

The error popup will only be shown when Tasks is starting up, but if the error persists,
it will be shown in the console every time this file is edited during the Obsidian
session.
`;
    this.logger.error(msg);
    if (e instanceof Error) {
      this.logger.error(e.stack ? e.stack : "Cannot determine stack");
    }
    if (this.state === State.Initializing) {
      new Notice(msg, 10000);
    }
  }
}
