import { generateUniqueId, toEditorRange } from "src/lib/utils";
import { IncrTask } from "../IncrTask/IncrTask";
import { getSettings } from "src/Config/Settings";
import { TaskRegularExpressions } from "src/IncrTask/TaskRegularExpressions";

const dropSymbol = "🌢";
const moonview = "🎑";
const flowercard = "🎴";
const label = "🏷";

const incrTaskSymbol = "🔃";

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * A subset of fields of {@link Task} that can be parsed from the textual
 * description of that Task.
 *
 * All fields are writeable for convenience.
 */
export type TaskDetails = Writeable<
  Pick<
    IncrTask,
    // NEW_TASK_FIELD_EDIT_REQUIRED
    "checked" | "description" | "increment" | "current" | "total" | "dependsOn" | "id" | "tags"
  >
>;

// The allowed characters in a single task id:
export const taskIdRegex = /[a-zA-Z0-9-_]+/;

export class IncrTaskSerializer {
  //constructor(public readonly symbols: IncrTaskSerializerSymbols) {}

  /* Convert a task to its string representation
   *
   * @param task The task to serialize
   *
   * @return The string representation of the task
   */
  public static serialize(task: IncrTask): string {
    let id = generateUniqueId([]);
    let tasks = [
      `- [ ] ${getSettings().incrementalTaskTag} ${task.description.trim()} 🔁 ${task.increment.trim()} 0/${
        task.total
      } ⛔ ${id}`,
    ];
    for (var i = 1; i < task.total; i++) {
      tasks.push(`\t- [ ] ${getSettings().taskTag} ${task.description.trim()} - ${task.increment} ${i}`);
    }

    tasks[1] = tasks[1] + ` 🆔 ${id}`;
    return tasks.join("\n");
  }

  /* Parse TaskDetails from the textual description of a {@link IncrTask}
   *
   * @param line The string to parse
   *
   * @return {TaskDetails}
   */
  public static deserialize(line: string): TaskDetails {
    let checked: boolean = false;
    let current: number = 0;
    let total: number = 0;
    let id: string = '';
    let dependsOn: string[] | [] = [];
    let description: string = '';
    let increment:string = '';
    
    // Tags that are removed from the end while parsing, but we want to add them back for being part of the description.
    // In the original task description they are possibly mixed with other components
    // (e.g. #tag1 <due date> #tag2), they do not have to all trail all task components,
    // but eventually we want to paste them back to the task description at the end
    let trailingTags = "";

    const checkMatch = line.match(TaskRegularExpressions.checkboxRegex);
    if (checkMatch != null) checked = checkMatch[1] ? checkMatch[1] !== " " : false;

    const progressMatch = line.match(TaskRegularExpressions.progressRegex);
    if (progressMatch != null) {
      current = parseInt(progressMatch[1])
      total = parseInt(progressMatch[2])
    }

    // Match tags from the end to allow users to mix the various task components with
    // tags. These tags will be added back to the description below
    const tagsMatch = line.match(TaskRegularExpressions.hashTagsFromEnd);
    if (tagsMatch != null) {
      line = line.replace(TaskRegularExpressions.hashTagsFromEnd, "").trim();
      const tagName = tagsMatch[0].trim();
      // Adding to the left because the matching is done right-to-left
      trailingTags = trailingTags.length > 0 ? [tagName, trailingTags].join(" ") : tagName;
    }

    const descriptionMatch = line.match(TaskRegularExpressions.descriptionRegex);
    if (descriptionMatch != null) {
      // description had it's tags removed by tagsMatch above. 
      description = descriptionMatch[1].trim();
    }


    const idMatch = line.match(TaskRegularExpressions.idRegex);
    if (idMatch != null) id = idMatch[1].trim();
    

    const dependsOnMatch = line.match(TaskRegularExpressions.dependsOnRegex);
    if (dependsOnMatch != null) {
      dependsOn = dependsOnMatch[1]
        .replace(/ /g, "")
        .split(",")
        .filter((item) => item !== "");
    }

    return {
      checked,
      description,
      increment,
      current,
      total,
      dependsOn,
      id,
      tags: IncrTask.extractHashtags(line),
      //subtasks: [],
    };
  }
}
