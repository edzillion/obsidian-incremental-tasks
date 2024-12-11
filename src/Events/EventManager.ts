import { App, EventRef } from "obsidian";
import { EditorHandler } from "./EditorHandler";

export class EventManager {
  private readonly events: EventRef[] = [];

  constructor(private app: App) {}

  registerEditorEvents(handler: EditorHandler) {
    this.events.push(
      this.app.workspace.on("editor-change", handler.onChange),
      this.app.workspace.on("active-leaf-change", handler.onActiveLeafChange)
    );
  }

  unregisterAll() {
    this.events.forEach((event) => this.app.vault.offref(event));
  }
}