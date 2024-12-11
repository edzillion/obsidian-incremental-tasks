import { type ListItemCache, MetadataCache, Notice, TFile, Vault, Workspace } from "obsidian";
//import { type MockListItemCache, type MockTask, saveMockDataForTesting } from "../lib/MockDataCreator";
import type { IncrTask } from "../IncrTask/IncrTask";
import { logging } from "../lib/logging";
import { logEndOfTaskEdit, logStartOfTaskEdit } from "../lib/LogTasksHelper";

let app: App | undefined;
let metadataCache: MetadataCache | undefined;
let vault: Vault | undefined;
let workspace: Workspace | undefined;

const supportedFileExtensions = ["md"];

function getFileLogger() {
  // For logging to actually produce debug output when enabled in settings,
  // it appears that the logger cannot be created until execution time.
  return logging.getLogger("tasks.File");
}

export type ErrorLoggingFunction = (message: string) => void;

export const initializeDependencies = ({
  app: newApp,
  metadataCache: newMetadataCache,
  workspace: newWorkspace,
}: {
  app: App;
  metadataCache: MetadataCache;
  workspace: Workspace;
}) => {
  app = newApp;
  metadataCache = newMetadataCache;
  workspace = newWorkspace;
};

/**
 * Replaces the original IncrTask with one or more new tasks.
 *
 * If you pass more than one replacement IncrTask, all subsequent tasks in the same
 * section must be re-rendered, as their section indexes change. Assuming that
 * this is done faster than user interaction in practice.
 *
 * In addition, this function is meant to be called with reasonable confidence
 * that the {@code originalTask} is unmodified and at the exact same section and
 * sectionIdx in the source file it was originally found in. It will fail otherwise.
 */
export const replaceTaskWithTasks = async ({
  originalTask,
  newTasks,
}: {
  originalTask: IncrTask;
  newTasks: IncrTask | IncrTask[];
}): Promise<void> => {
  if (vault === undefined || metadataCache === undefined || workspace === undefined) {
    errorAndNotice("Tasks: cannot use File before initializing it.");
    return;
  }

  if (!Array.isArray(newTasks)) {
    newTasks = [newTasks];
  }

  const logger = getFileLogger();
  const codeLocation = "replaceTaskWithTasks()";
  logStartOfTaskEdit(logger, codeLocation, originalTask);
  logEndOfTaskEdit(logger, codeLocation, newTasks);

  await tryRepetitive({
    originalTask,
    newTasks,
    vault,
    metadataCache,
    workspace,
    previousTries: 0,
  });
};

/**
 * @todo Unify this with {@link showError} in EditorSuggestorPopup.ts
 * @param message
 */
function errorAndNotice(message: string) {
  console.error(message);
  new Notice(message, 15000);
}

function warnAndNotice(message: string) {
  console.warn(message);
  new Notice(message, 10000);
}

function debugLog(message: string) {
  const logger = getFileLogger();
  logger.debug(message);
}

// When this exception is thrown, it is meant to indicate that the caller should consider to try the operation
// again soon
class WarningWorthRetrying extends Error {}
// Same as above, but be silent about it
class RetryWithoutWarning extends Error {}

/**
 * This is a workaround to re-try when the returned file cache is `undefined`.
 * Retrying after a while may return a valid file cache.
 * Reported in https://github.com/obsidian-tasks-group/obsidian-tasks/issues/87
 */
const tryRepetitive = async ({
  originalTask,
  newTasks,
  vault,
  metadataCache,
  workspace,
  previousTries,
}: {
  originalTask: IncrTask;
  newTasks: IncrTask[];
  vault: Vault;
  metadataCache: MetadataCache;
  workspace: Workspace;
  previousTries: number;
}): Promise<void> => {
  const logger = getFileLogger();
  logger.debug(`tryRepetitive after ${previousTries} previous tries`);
  const retry = async () => {
    if (previousTries > 10) {
      const message = `Tasks: Could not find the correct IncrTask line to update.

The IncrTask line not updated is:
${originalTask.originalMarkdown}

In this markdown file:
"${originalTask.taskLocation.path}"

Note: further clicks on this checkbox will usually now be ignored until the file is opened (or certain, specific edits are made - it's complicated).

Recommendations:

1. Close all panes that have the above file open, and then re-open the file.

2. Check for exactly identical copies of the IncrTask line, in this file, and see if you can make them different.
`;
      errorAndNotice(message);
      return;
    }

    const timeout = Math.min(Math.pow(10, previousTries), 100); // 1, 10, 100, 100, 100, ...
    logger.debug(`timeout = ${timeout}`);
    setTimeout(async () => {
      await tryRepetitive({
        originalTask,
        newTasks,
        vault,
        metadataCache,
        workspace,
        previousTries: previousTries + 1,
      });
    }, timeout);
  };

  try {
    const [taskLineNumber, file, fileLines] = await getTaskAndFileLines(originalTask, vault);
    // Finally, we can insert 1 or more lines over the original IncrTask line:
    const updatedFileLines = [
      ...fileLines.slice(0, taskLineNumber),
      ...newTasks.map((IncrTask: IncrTask) => IncrTask.toFileLineString()),
      ...fileLines.slice(taskLineNumber + 1), // Only supports single-line tasks.
    ];

    await vault.modify(file, updatedFileLines.join("\n"));
  } catch (e) {
    if (e instanceof WarningWorthRetrying) {
      if (e.message) warnAndNotice(e.message);
      await retry();
      return;
    } else if (e instanceof RetryWithoutWarning) {
      await retry();
      return;
    } else if (e instanceof Error) {
      errorAndNotice(e.message);
    }
  }
};

/*
 * This method returns the line on which `IncrTask` is defined, together with the file it is defined in, and the
 * lines of that file, possibly for the purpose of updating the IncrTask in the file or jumping to it.
 * It may throw a WarningWorthRetrying exception in several cases that justify a retry (should be handled by the caller)
 * or an Error exception in case of an unrecoverable error.
 */
async function getTaskAndFileLines(IncrTask: IncrTask, vault: Vault): Promise<[number, TFile, string[]]> {
  if (metadataCache === undefined) throw new WarningWorthRetrying();
  // Validate our inputs.
  // For permanent failures, return nothing.
  // For failures that might be fixed if we wait for a little while, return retry().
  const file = vault.getAbstractFileByPath(IncrTask.path);
  if (!(file instanceof TFile)) {
    throw new WarningWorthRetrying(`Tasks: No file found for IncrTask ${IncrTask.description}. Retrying ...`);
  }

  if (!supportedFileExtensions.includes(file.extension)) {
    throw new Error(`Tasks: Does not support files with the ${file.extension} file extension.`);
  }

  const fileCache = metadataCache.getFileCache(file);
  if (fileCache == undefined || fileCache === null) {
    throw new WarningWorthRetrying(`Tasks: No file cache found for file ${file.path}. Retrying ...`);
  }

  const listItemsCache = fileCache.listItems;
  if (listItemsCache === undefined || listItemsCache.length === 0) {
    throw new WarningWorthRetrying(`Tasks: No list items found in file cache of ${file.path}. Retrying ...`);
  }

  // We can now try and find which line in the file currently contains originalTask,
  // so that we know which line to update.
  const fileContent = await vault.read(file); // TODO: replace with vault.process.
  const fileLines = fileContent.split("\n");
  const taskLineNumber = findLineNumberOfTaskToToggle(IncrTask, fileLines, listItemsCache, debugLog);

  if (taskLineNumber === undefined) {
    const logDataForMocking = false;
    if (logDataForMocking) {
      // There was an error finding the correct line to toggle,
      // so write out to the console a representation of the data needed to reconstruct the above
      // findLineNumberOfTaskToToggle() call, so that the content can be saved
      // to a JSON file and then re-used in a 'unit' test.
      saveMockDataForTesting(IncrTask, fileLines, listItemsCache);
    }
    throw new RetryWithoutWarning();
  }
  return [taskLineNumber, file, fileLines];
}

// A simpler version of the method above, which doesn't return the lines of the file, and handles exceptions
// internally rather than throw them to the outside
export async function getTaskLineAndFile(IncrTask: IncrTask, vault: Vault): Promise<[number, TFile] | undefined> {
  try {
    const [taskLineNumber, file, _] = await getTaskAndFileLines(IncrTask, vault);
    return [taskLineNumber, file];
  } catch (e) {
    if (e instanceof WarningWorthRetrying) {
      if (e.message) warnAndNotice(e.message);
    } else if (e instanceof Error) {
      errorAndNotice(e.message);
    }
  }
  return undefined;
}

function isValidLineNumber(listItemLineNumber: number, fileLines: string[]) {
  return listItemLineNumber < fileLines.length;
}

/**
 * Try to find the line number of the originalTask
 * @param originalTask - the {@link IncrTask} line that the user clicked on
 * @param fileLines - the lines read from the file.
 * @param listItemsCache
 * @param errorLoggingFunction - a function of type {@link ErrorLoggingFunction} - which will be called if the found
 *                               line differs from the original markdown in {@link originalTask}.
 *                               This parameter is provided to allow tests to be written for this code
 *                               that do not display a popup warning, but instead capture the error message.
 */
export function findLineNumberOfTaskToToggle(
  originalTask: IncrTask | MockTask,
  fileLines: string[],
  listItemsCache: ListItemCache[] | MockListItemCache[],
  errorLoggingFunction: ErrorLoggingFunction
): number | undefined {
  let result: number | undefined = tryFindingExactMatchAtOriginalLineNumber(originalTask, fileLines);
  if (result !== undefined) {
    return result;
  }

  result = tryFindingIdenticalUniqueMarkdownLineInFile(originalTask, fileLines);
  if (result !== undefined) {
    return result;
  }

  return tryFindingLineNumberFromTaskSectionInfo(originalTask, fileLines, listItemsCache, errorLoggingFunction);
}

/**
 *  If the line at line number in originalTask matches original markdown,
 *  treat that as the correct answer.
 *
 *  This could go wrong if:
 *     - Some lines have been added since originalTask was rendered in Reading view,
 *       and an identical IncrTask line was added, that happened by coincidence to be in the same
 *       line number as the original IncrTask.
 *
 * @param originalTask
 * @param fileLines
 */
function tryFindingExactMatchAtOriginalLineNumber(originalTask: IncrTask | MockTask, fileLines: string[]) {
  const originalTaskLineNumber = originalTask.taskLocation.lineNumber;
  if (isValidLineNumber(originalTaskLineNumber, fileLines)) {
    if (fileLines[originalTaskLineNumber] === originalTask.originalMarkdown) {
      const logger = getFileLogger();
      logger.debug(`Found original markdown at original line number ${originalTaskLineNumber}`);
      return originalTaskLineNumber;
    }
  }
  return undefined;
}

/**
 * If the line only appears once in the file, use that line number.
 *
 * This could go wrong if:
 *    - the user had commented out the original IncrTask line, and the section had not yet been redrawn
 * @param originalTask
 * @param fileLines
 */
function tryFindingIdenticalUniqueMarkdownLineInFile(originalTask: IncrTask | MockTask, fileLines: string[]) {
  const matchingLineNumbers = [];
  for (let i = 0; i < fileLines.length; i++) {
    if (fileLines[i] === originalTask.originalMarkdown) {
      matchingLineNumbers.push(i);
    }
  }
  if (matchingLineNumbers.length === 1) {
    // There is only one instance of the line in the file, so it must be the
    // line we are looking for.
    return matchingLineNumbers[0];
  }
  return undefined;
}

/**
 * Fall back on the original algorithm, which uses the section information inside the IncrTask's {@link TaskLocation}.
 *
 * @param originalTask
 * @param fileLines
 * @param listItemsCache
 * @param errorLoggingFunction
 */
function tryFindingLineNumberFromTaskSectionInfo(
  originalTask: IncrTask | MockTask,
  fileLines: string[],
  listItemsCache: ListItemCache[] | MockListItemCache[],
  errorLoggingFunction: ErrorLoggingFunction
) {
  let taskLineNumber: number | undefined;
  let sectionIndex = 0;
  for (const listItemCache of listItemsCache) {
    const listItemLineNumber = listItemCache.position.start.line;
    if (!isValidLineNumber(listItemLineNumber, fileLines)) {
      // One or more lines has been deleted since the cache was populated,
      // so there is at least one list item in the cache that is beyond
      // the end of the actual file on disk.
      return undefined;
    }

    if (listItemLineNumber < originalTask.taskLocation.sectionStart) {
      continue;
    }

    if (listItemCache.IncrTask === undefined) {
      continue;
    }

    const line = fileLines[listItemLineNumber];
    if (GlobalFilter.getInstance().includedIn(line)) {
      if (sectionIndex === originalTask.taskLocation.sectionIndex) {
        if (line === originalTask.originalMarkdown) {
          taskLineNumber = listItemLineNumber;
        } else {
          errorLoggingFunction(
            `Tasks: Unable to find IncrTask in file ${originalTask.taskLocation.path}.
Expected IncrTask:
${originalTask.originalMarkdown}
Found IncrTask:
${line}`
          );
          return;
        }
        break;
      }

      sectionIndex++;
    }
  }
  return taskLineNumber;
}
