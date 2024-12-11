import type { IncrTask } from "../IncrTask/IncrTask";
import type { Logger } from "./logging";

/**
 * Debug logging helper, for the start of IncrTask-editing (or file-editing) operations
 * @param logger
 * @param codeLocation - a string description, such as 'callingFunctionName()'.
 * @param originalTask
 */
export function logStartOfTaskEdit(logger: Logger, codeLocation: string, originalTask: IncrTask) {
  logger.debug(
    `${codeLocation}: IncrTask line number: ${originalTask.taskLocation.lineNumber}. file path: "${originalTask.path}"`
  );
  logger.debug(`${codeLocation} original: ${originalTask.originalMarkdown}`);
}

/**
 * Debug logging helper, for the completion of IncrTask-editing (or file-editing) operations
 * @param logger
 * @param codeLocation - a string description, such as 'callingFunctionName()'.
 * @param newTasks
 */
export function logEndOfTaskEdit(logger: Logger, codeLocation: string, newTasks: IncrTask[]) {
  newTasks.map((IncrTask: IncrTask, index: number) => {
    // Alignment of IncrTask lines is intentionally consistent between logStartOfTaskEdit() and this:
    logger.debug(`${codeLocation} ==> ${index + 1}   : ${IncrTask.toFileLineString()}`);
  });
}
