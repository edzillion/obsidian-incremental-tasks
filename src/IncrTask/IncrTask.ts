import { getSettings } from "../Config/Settings";
import { logging } from "../lib/logging";
import { logEndOfTaskEdit, logStartOfTaskEdit } from "../lib/LogTasksHelper";
import { ListItem } from "./ListItem";
import { TaskRegularExpressions } from "./TaskRegularExpressions";
import { EditorRange } from "obsidian";
import { IncrTaskSerializer } from "src/Serializer/IncrTaskSerializer";
import { TaskService } from "./TaskService";
import { TaskLocation } from "./TaskLocation";

/**
 * Storage for the task line, broken down in to sections.
 * See {@link Task.extractTaskComponents} for use.
 */
interface TaskComponents {
  indentation: string;
  listMarker: string;
  body: string;
}

interface IncrTaskProperties {
  checked: boolean;
  description: string;
  increment: string;
  current: number;
  total: number;
  taskLocation: TaskLocation;
  indentation: string;
  listMarker: string;
  tags: string[];
  dependsOn: string[];
  id?: string;
  parent: ListItem | null;
  originalMarkdown: string;
}

/**
 * Task encapsulates the properties of the MarkDown task along with
 * the extensions provided by this plugin. This is used to parse and
 * generate the markdown task for all updates and replacements.
 *
 * @export
 * @class IncrTask
 */
export class IncrTask extends ListItem {
  // NEW_TASK_FIELD_EDIT_REQUIRED
  public checked: boolean;
  public readonly description: string;
  public readonly increment: string;
  public readonly current: number;
  public readonly total: number;
  public readonly taskLocation: TaskLocation;
  public readonly indentation: string;
  public readonly listMarker: string;

  public readonly tags: string[];

  public readonly dependsOn: string[] = [];
  public readonly id?: string;
  public readonly originalMarkdown: string;

  private static taskService: TaskService;

  constructor(private taskService: TaskService, properties: IncrTaskProperties) {
    super(properties.originalMarkdown, properties.parent);
    IncrTask.taskService = taskService;
    Object.assign(this, properties);
  }

  public get path(): string {
    return this.taskLocation.path;
  }

  // constructor(
  //   private taskService: TaskService,
  //   {
  //     // NEW_TASK_FIELD_EDIT_REQUIRED
  //     checked,
  //     description,
  //     increment,
  //     current,
  //     total,
  //     range,
  //     indentation,
  //     listMarker,
  //     dependsOn,
  //     id,
  //     tags,
  //     originalMarkdown,
  //     parent = null,
  //   }: {
  //     // NEW_TASK_FIELD_EDIT_REQUIRED
  //     checked: boolean;
  //     description: string;
  //     increment: string;
  //     current: number;
  //     total: number;
  //     range: EditorRange;
  //     indentation: string;
  //     listMarker: string;
  //     dependsOn?: string[] | [];
  //     id?: string;
  //     tags: string[] | [];
  //     originalMarkdown: string;
  //     parent?: ListItem | null;
  //   }
  // ) {
  //   this.checked = checked;
  //   this.increment = increment;
  //   this.current = current;
  //   this.total = total;
  //   this.range = range;
  //   // NEW_TASK_FIELD_EDIT_REQUIRED
  //   this.description = description;
  //   this.indentation = indentation;
  //   this.listMarker = listMarker;

  //   this.tags = tags;
  //   this.originalMarkdown = originalMarkdown;
  //   this.dependsOn = dependsOn;
  //   this.id = id;
  // }

  static setTaskService(service: TaskService) {
    IncrTask.taskService = service;
  }

  static create(props: IncrTaskProperties): IncrTask {
    return new IncrTask(IncrTask.taskService, props);
  }

  // /**
  //  * Takes the given line from an Obsidian note and returns a Task object.
  //  * Will check if Global Filter is present in the line.
  //  *
  //  * If you want to specify a parent ListItem or Task after a fromLine call,
  //  * you have to do the following:
  //  * @example
  //  *  const finalTask = new Task({ ...firstReadTask!, parent: parentListItem });
  //  *
  //  * @static
  //  * @param {string} line - The full line in the note to parse.
  //  * @param {TaskLocation} taskLocation - The location of the task line
  //  * @param {(Moment | null)} fallbackDate - The date to use as the scheduled date if no other date is set
  //  * @return {*}  {(Task | null)}
  //  * @memberof Task
  //  * @see parseTaskSignifiers
  //  */
  // public static fromLine2({ line, range }: { line: string; range: EditorRange }): IncrTask | null {
  //   const taskComponents = IncrTask.extractTaskComponents(line);
  //   // Check the line to see if it is a markdown task.
  //   if (taskComponents === null) {
  //     return null;
  //   }

  //   // return if the line does not have the global filter. Do this before
  //   // any other processing to improve performance.
  //   if (!taskComponents.body.includes(getSettings().incrementalTaskTag)) {
  //     return null;
  //   }

  //   return IncrTask.parseTaskSignifiers(line, range);
  // }

  /**
   * Takes the given line from an Obsidian note and returns a Task object.
   * Will check if Global Filter is present in the line.
   *
   * If you want to specify a parent ListItem or Task after a fromLine call,
   * you have to do the following:
   * @example
   *  const finalTask = new Task({ ...firstReadTask!, parent: parentListItem });
   *
   * @static
   * @param {string} line - The full line in the note to parse.
   * @param {TaskLocation} taskLocation - The location of the task line
   * @param {(Moment | null)} fallbackDate - The date to use as the scheduled date if no other date is set
   * @return {*}  {(Task | null)}
   * @memberof Task
   * @see parseTaskSignifiers
   */
  public static fromLine({ line, taskLocation }: { line: string; taskLocation: TaskLocation }): IncrTask | null {
    const taskComponents = IncrTask.extractTaskComponents(line);
    // Check the line to see if it is a markdown task.
    if (taskComponents === null) {
      return null;
    }

    // return if the line does not have the global filter. Do this before
    // any other processing to improve performance.
    if (!taskComponents.body.includes(getSettings().incrementalTaskTag)) {
      return null;
    }

    return IncrTask.parseTaskSignifiers(line, taskLocation);
  }

  // /**
  //  * Parses the line in attempt to get the task details.
  //  *
  //  * This reads the task even if the Global Filter is missing.
  //  * If a Global Filter check is needed, use {@link Task.fromLine}.
  //  *
  //  * Task is returned regardless if Global Filter is present or not.
  //  * However, if it is, it will be removed from the tags.
  //  *
  //  * @param line - the full line to parse
  //  * @param taskLocation - The location of the task line
  //  * @param fallbackDate - The date to use as the scheduled date if no other date is set
  //  * @returns {*} {(Task | null)}
  //  * @see fromLine
  //  */
  // public static parseTaskSignifier2(line: string, taskLocation: TaskLocation): IncrTask | null {
  //   const taskComponents = IncrTask.extractTaskComponents(line);
  //   // Check the line to see if it is a markdown task.
  //   if (taskComponents === null) {
  //     return null;
  //   }

  //   const taskInfo = IncrTaskSerializer.deserialize(taskComponents.body);

  //   //const range = //range: lineNum ? toEditorRange(line, lineNum)

  //   // Ensure that whitespace is removed around tags
  //   taskInfo.tags = taskInfo.tags.map((tag) => tag.trim());

  //   // Remove the Global Filter if it is there
  //   taskInfo.tags = taskInfo.tags.filter((tag) => getSettings().incrementalTaskTag !== tag);

  //   return IncrTask.create({
  //     ...taskComponents,
  //     ...taskInfo,
  //     parent: null,
  //     originalMarkdown: line,
  //   });
  // }

  /**
   * Parses the line in attempt to get the task details.
   *
   * This reads the task even if the Global Filter is missing.
   * If a Global Filter check is needed, use {@link Task.fromLine}.
   *
   * Task is returned regardless if Global Filter is present or not.
   * However, if it is, it will be removed from the tags.
   *
   * @param line - the full line to parse
   * @param taskLocation - The location of the task line
   * @returns {*} {(Task | null)}
   * @see fromLine
   */
  public static parseTaskSignifiers(line: string, taskLocation: TaskLocation): IncrTask | null {
    const taskComponents = IncrTask.extractTaskComponents(line);
    // Check the line to see if it is a markdown task.
    if (taskComponents === null) {
      return null;
    }

    const taskInfo = IncrTaskSerializer.deserialize(taskComponents.body);

    // Ensure that whitespace is removed around tags
    taskInfo.tags = taskInfo.tags.map((tag) => tag.trim());

    // Remove the Global Filter if it is there
    taskInfo.tags = taskInfo.tags.filter((tag) => tag !== getSettings().incrementalTaskTag);

    // TODO: do this better

    return IncrTask.create({
      ...taskComponents,
      ...taskInfo,
      taskLocation: taskLocation,
      originalMarkdown: line,
      parent:null,
    });
  }

  /**
   * Extract the component parts of the task line.
   * @param line
   * @returns a {@link TaskComponents} object containing the component parts of the task line
   */
  static extractTaskComponents(line: string): TaskComponents | null {
    // Check the line to see if it is a markdown task.
    const regexMatch = line.match(TaskRegularExpressions.taskRegex);
    if (regexMatch === null) {
      return null;
    }

    const indentation = regexMatch[1];
    const listMarker = regexMatch[2];

    // match[4] includes the whole body of the task after the brackets.
    let body = regexMatch[4].trim();

    // Match for block link and remove if found. Always expected to be
    // at the end of the line.
    const blockLinkMatch = body.match(TaskRegularExpressions.blockLinkRegex);
    const blockLink = blockLinkMatch !== null ? blockLinkMatch[0] : "";

    if (blockLink !== "") {
      body = body.replace(TaskRegularExpressions.blockLinkRegex, "").trim();
    }
    return { indentation, listMarker, body };
  }

  private static getTaskLineRange(taskLine: string, lineNum: number): EditorRange {
    return {
      from: {
        ch: 0,
        line: lineNum,
      },
      to: {
        ch: taskLine.length,
        line: lineNum,
      },
    };
  }

  /**
   * Flatten the task as a string that includes all its components.
   *
   * @note Output depends on {@link Settings.taskFormat}
   * @return {*}  {string}
   * @memberof Task
   */
  public toString(): string {
    return IncrTaskSerializer.serialize(this);
  }

  /**
   * Returns the Task as a list item with a checkbox.
   *
   * @note Output depends on {@link Settings.taskFormat}
   * @return {*}  {string}
   * @memberof Task
   */
  public toFileLineString(): string {
    return `${this.indentation}${this.listMarker} ${this.toString()}`;
  }

  /**
   * Toggles this task and returns the resulting task(s).
   *
   * Use this method if you need to know which is the original (completed)
   * task and which is the new recurrence.
   *
   * If the task is not recurring, it will return `[toggled]`.
   *
   * Toggling can result in more than one returned task in the case of
   * recurrence. In this case, the toggled task will be returned
   * together with the next occurrence in the order `[next, toggled]`.
   *
   * There is a possibility to use user set order `[next, toggled]`
   * or `[toggled, next]` - {@link toggleWithRecurrenceInUsersOrder}.
   *
   */
  public toggle(): IncrTask[] {
    return this.taskService.toggle(this);
  }

  /**
   * Return whether the task is considered done.
   * @returns true if the status type is {@link StatusType.DONE}, {@link StatusType.CANCELLED} or {@link StatusType.NON_TASK}, and false otherwise.
   */
  public get isDone(): boolean {
    return this.checked;
  }

  /**
   * A task is treated as blocked if it depends on any existing task ids on tasks that are TODO or IN_PROGRESS.
   *
   * 'Done' tasks (with status DONE, CANCELLED or NON_TASK) are never blocked.
   * Only direct dependencies are considered.
   * @param allTasks - all the tasks in the vault. In custom queries, this is available via query.allTasks.
   */
  public isBlocked(allTasks: Readonly<IncrTask[]>) {
    if (this.dependsOn.length === 0) {
      return false;
    }

    if (this.isDone) {
      return false;
    }

    for (const depId of this.dependsOn) {
      const depTask = allTasks.find((task: IncrTask) => task.id === depId && !task.isDone);
      if (!depTask) {
        // There is no not-done task with this id.
        continue;
      }

      // We found a not-done task that this depends on, meaning this one is blocked:
      return true;
    }

    return false;
  }

  /**
   * Return a copy of the description, with any tags removed.
   *
   * Note that this removes tags recognised by Tasks (including removing #123, for example),
   * as opposed to tags recognised by Obsidian, which does not treat numbers-only as valid tags.
   */
  public get descriptionWithoutTags(): string {
    return this.description.replace(TaskRegularExpressions.hashTags, "").trim();
  }

  get lineNumber(): number {
    return this.taskLocation.lineNumber;
  }

  /**
   * Compare all the fields in another Task, to detect any differences from this one.
   *
   * If any field is different in any way, it will return false.
   *
   * This is used in some optimisations, to avoid work if an edit to file
   * does not change any tasks, so it is vital that its definition
   * of identical is very strict.
   *
   * @param other
   */
  public identicalTo(other: IncrTask) {
    // // First compare child Task and ListItem objects, and any other data in ListItem:
    // if (!super.identicalTo(other)) {
    //   return false;
    // }

    // NEW_TASK_FIELD_EDIT_REQUIRED

    // Based on ideas from koala. AquaCat and javalent in Discord:
    // https://discord.com/channels/686053708261228577/840286264964022302/996735200388186182
    // and later.
    //
    // Note: sectionStart changes every time a line is added or deleted before
    //       any of the tasks in a file. This does mean that redrawing of tasks blocks
    //       happens more often than is ideal.
    let args: Array<keyof IncrTask> = [
      "description",
      "indentation",
      "listMarker",
      "lineNumber",
      //"blockLink",
      "id",
      "dependsOn",
    ];
    for (const el of args) {
      if (this[el]?.toString() !== other[el]?.toString()) return false;
    }

    // Compare tags
    if (this.tags.length !== other.tags.length) {
      return false;
    }
    // Tags are the same only if the values are in the same order
    if (
      !this.tags.every(function (element, index) {
        return element === other.tags[index];
      })
    ) {
      return false;
    }

    return true;
  }

  /**
   * Returns an array of hashtags found in string
   *
   * @param description A task description that may contain hashtags
   *
   * @returns An array of hashTags found in the string
   */
  public static extractHashtags(description: string): string[] {
    return description.match(TaskRegularExpressions.hashTags)?.map((tag) => tag.trim()) ?? [];
  }
}

/**
 * A task is treated as blocked if it depends on any existing task ids on tasks that are TODO or IN_PROGRESS.
 *
 * 'Done' tasks (with status DONE, CANCELLED or NON_TASK) are never blocked.
 * @param thisTask
 * @param allTasks
 */
export function isBlocked(thisTask: IncrTask, allTasks: IncrTask[]) {
  if (thisTask.dependsOn.length === 0) {
    return false;
  }

  if (thisTask.isDone) {
    return false;
  }

  for (const depId of thisTask.dependsOn) {
    const depTask = allTasks.find((task) => task.id === depId && !task.isDone);
    if (!depTask) {
      // There is no not-done task with this id.
      continue;
    }

    // We found a not-done task that this depends on, meaning this one is blocked:
    return true;
  }

  return false;
}
