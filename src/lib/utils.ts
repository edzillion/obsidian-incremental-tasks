import { EditorRange } from "obsidian";

  export function generateUniqueId(existingIds: string[]) {
    let id = "";
    let keepGenerating = true;
    const length = 6;

    while (keepGenerating) {
      // from https://www.codemzy.com/blog/random-unique-id-javascript
      id = Math.random()
        .toString(36)
        .substring(2, length + 2);

      if (!existingIds.includes(id)) {
        keepGenerating = false;
      }
    }
    return id;
  }

  export function toEditorRange(taskLine: string, lineNum: number): EditorRange {
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