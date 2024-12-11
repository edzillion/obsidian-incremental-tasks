import { PluginSettingTab, App, Setting } from "obsidian";
import IncrementalTaskPlugin from "../main";
import { LogOptions } from "../lib/logging";

interface SettingsMap {
  [key: string]: string | boolean;
}

export type HeadingState = {
  [id: string]: boolean;
};

export interface IncrementalTaskSettings {
  taskTag: string;
  incrementalTaskTag: string;
  history: string[];
  loggingOptions: LogOptions;
}

export const DEFAULT_SETTINGS: IncrementalTaskSettings = {
  taskTag: "#task",
  incrementalTaskTag: "#task/incr",
  history: [],
  /*
    `loggingOptions` is a property in the `Settings` interface that defines the logging options for
    the application. It is an object that contains a `minLevels` property, which is a map of logger
    names to their minimum logging levels. This allows the application to control the amount of
    logging output based on the logger name and the minimum logging level. For example, the logger
    name `tasks` might have a minimum logging level of `debug`, while the root logger might have a
    minimum logging level of `info`.
    */
  loggingOptions: {
    minLevels: {
      "": "info",
      tasks: "info",
      "tasks.Cache": "info", // Cache.ts
      "tasks.Events": "info", // TasksEvents.ts
      "tasks.File": "info", // File.ts
      "tasks.Query": "info", // Query.ts & QueryRenderer.ts
      "tasks.Task": "info", // Task.ts
    },
  },
};

export class IncrementalTaskSettingTab extends PluginSettingTab {
  plugin: IncrementalTaskPlugin;

  constructor({ plugin }: { plugin: IncrementalTaskPlugin }) {
    super(plugin.app, plugin);

    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Emoji Shortcodes Plugin" });

    new Setting(containerEl)
      .setName("Task Tag")
      .setDesc("Tag used for regular tasks")
      .addText((text) =>
        text
          .setPlaceholder("#task")
          .setValue(getSettings().taskTag)
          .onChange(async (value) => {
            getSettings().taskTag = value;
            updateSettings({ taskTag: value });
          })
      );

    new Setting(containerEl)
      .setName("Incremental Task Tag")
      .setDesc("Tag used for incremental tasks")
      .addText((text) =>
        text
          .setPlaceholder("#task/incr")
          .setValue(getSettings().incrementalTaskTag)
          .onChange(async (value) => {
            updateSettings({ incrementalTaskTag :value});
            // getSettings().incrementalTaskTag = value;
            //await this.plugin.saveSettings();
          })
      );

    // new Setting(containerEl)
    //   .setName("Donate")
    //   .setDesc("If you like this Plugin, consider donating to support continued development:")
    //   .addButton((bt) => {
    //     bt.buttonEl.outerHTML = `<a href="https://ko-fi.com/phibr0"><img src="https://uploads-ssl.webflow.com/5c14e387dab576fe667689cf/61e11e22d8ff4a5b4a1b3346_Supportbutton-1.png"></a>`;
    //   });
  }
}

let settings: IncrementalTaskSettings = { ...DEFAULT_SETTINGS };


/**
 * Returns the current settings as a object, it will also check and
 * update the flags to make sure they are all shown in the data.json
 * file. Exposure via the settings UI is optional.
 *
 * @export
 * @returns settings
 */
export const getSettings = (): IncrementalTaskSettings => {
    return { ...settings };
};

export const updateSettings = (newSettings: Partial<IncrementalTaskSettings>): IncrementalTaskSettings => {
  settings = { ...settings, ...newSettings };
  return getSettings();
};

export const resetSettings = (): IncrementalTaskSettings => {
  return updateSettings(DEFAULT_SETTINGS);
};