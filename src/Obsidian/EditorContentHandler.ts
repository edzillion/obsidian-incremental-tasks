import { EditorView, ViewPlugin } from "@codemirror/view";
import type { PluginValue } from "@codemirror/view";
import { MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { IncrTask } from "../IncrTask/IncrTask";
import { IncrTaskEvents } from "src/Events/IncrTaskEvents";
import TasksPlugin from "../main";
import { getTasksFromEditorContent } from "./Cache";

export const newEditorContentHandler = () => {
  return ViewPlugin.fromClass(EditorContentHandler);
};

class EditorContentHandler implements PluginValue {
  private readonly view: EditorView;
  private lastOpenedFile: TFile | null = null;
  private fileLoadedProcessed = false;
  private cache: any;

  constructor(view: EditorView) {
    this.cache = TasksPlugin.getCache();
    this.view = view;

    // this.handleClickEvent = this.handleClickEvent.bind(this);
    //this.view.dom.addEventListener("click", this.handleClickEvent);

  }

  attachHandlers(view: EditorView) {
    // Add click handlers to visible elements
    //   const checkboxes = view.dom.querySelectorAll(
    //     '.HyperMD-list-line:has(span.cm-hashtag-end:contains("task/incr")) input[type="checkbox"]'
    //     //'.cm-active.HyperMD-list-line:has(.cm-hashtag-end:contains("task/incr")) input[type="checkbox"]'
    //   );
    // const parentDivs = document.querySelectorAll(".cm-active.HyperMD-list-line");

    // const taskLines = view.dom.querySelectorAll(".HyperMD-list-line");
    // const checkboxes = Array.from(taskLines)
    // .filter((line) => {
    //   const hashtag = line.querySelector("span.cm-hashtag-end");
    //   return hashtag?.textContent === "task/incr";
    // })
    // .map((line) => line.querySelector('input[type="checkbox"]'));

    // First get the parent incr task line
    const parentLine = view.dom.querySelectorAll(".HyperMD-list-line:has(span.cm-hashtag-end)");

    parentLine.forEach((line) => {
      // Verify it's an incr task
      const hashtag = line.querySelector("span.cm-hashtag-end");
      if (hashtag?.textContent === "task/incr") {
        // Get checkboxes
        const parentCheckbox = line.querySelector('input[type="checkbox"]');

        // Get sibling subtasks
        let currentElement = line.nextElementSibling;
        const subtaskCheckboxes: HTMLInputElement[] = [];

        while (currentElement?.classList.contains("HyperMD-list-line")) {
          const subHashtag = currentElement.querySelector("span.cm-hashtag-end");
          if (subHashtag?.textContent === "task") {
            const checkbox = currentElement.querySelector('input[type="checkbox"]');
            if (checkbox) subtaskCheckboxes.push(checkbox as HTMLInputElement);
          }
          currentElement = currentElement.nextElementSibling;
        }

        const allCheckboxes = [parentCheckbox, ...subtaskCheckboxes];
        allCheckboxes.forEach((checkbox:HTMLInputElement) => 
          checkbox?.addEventListener("click", (event) => {
            //event.stopPropagation();
            console.log("Checkbox clicked:", checkbox);
            if (checkbox === parentCheckbox) {
              subtaskCheckboxes.forEach(subtask => subtask.checked = checkbox.checked);
            }
              // Your logic here to handle the checkbox click event
              // Example: Toggle the checked status of the checkbox and its sibling subtasks
              // checkbox.checked = !checkbox.checked;
            
          }));                
      }
    });
  }

  public setCache(cache: any) {
    this.cache = cache;
  }

  // private handleClickEvent(event: MouseEvent) {
  //   if (this.lastOpenedFile && !this.fileLoadedProcessed) {
  //     const editor = this.view.editor;
  //     if (editor) {
  //       const content = editor.getValue();
  //       console.log("Editor content after file load:", content);
  //       // Your logic here to attach handlers based on the editor content
  //       this.attachHandlersBasedOnContent(content);
  //       this.fileLoadedProcessed = true;
  //     }
  //   }
  // }

  // private attachHandlersBasedOnContent(content: string) {
  //   // Example: Attach a click handler to specific elements in the editor content
  //   const editorDom = this.view.dom;
  //   const elements = editorDom.querySelectorAll("span, a, img"); // Adjust the selector as needed
  //   elements.forEach((element) => {
  //     element.addEventListener("click", (event) => {
  //       console.log("Clicked element:", event.target);
  //       // Your logic here to handle the click event
  //     });
  //   });
  // }

  onunload() {
    //this.view.dom.removeEventListener("click", this.handleClickEvent);
  }
}
