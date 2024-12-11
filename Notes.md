# Notes

## Design choices
- Not obvious how to add a incremental task to an indented task list (i.e. as a subtask of a parent task)
- Does it make sense to accept random chars instead of x or X to denote checked box?

## Features
- ability to create a paritally completed task
- onCompletion in Tasks not supported
- interpret {{title}} in codeblock?
- allow multiple ids in brackets? 

```ts
// The allowed characters in a comma-separated sequence of task ids:
export const taskIdSequenceRegex = new RegExp(taskIdRegex.source + "( *, *" + taskIdRegex.source + " *)*");
```

## Tooling
- DebugSettings?

## TODO
- make sure generated ids are unique
- use transaction for editor changes
- remove click handlers on unload
- replace #task/tag literals with settings
- limit line reading scripts to relevant lines


```ts
    setCurrentCacheFile(testData);
    return getTasksFromFileContent2(
        testData.filePath,
        testData.fileContents,
        testData.cachedMetadata.listItems!,
        logger,
        testData.cachedMetadata,
        errorReporter,
    );
```


on load, check all files for incrtasks, load them into cache incrtasks array using deserializer, give each it's own id and location.
on file load, check for tasks in the tasks db and then apply any ui event handlers to checkboxes.
on codeblock execution edit current editor to add incrtasks.

