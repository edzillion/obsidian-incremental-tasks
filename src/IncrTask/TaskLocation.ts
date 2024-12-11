/**
 * TaskLocation is the place where all information about a task line's location
 * in a markdown file is stored, so that testable algorithms can then be added here.
 */
export class TaskLocation {
  private readonly _path: string;
  private readonly _lineNumber: number;
  private readonly _sectionStart: number;
  private readonly _sectionIndex: number;

  public constructor(
    path: string,
    lineNumber: number,
    sectionStart: number,
    sectionIndex: number,
  ) {
    this._path = path;
    this._lineNumber = lineNumber;
    this._sectionStart = sectionStart;
    this._sectionIndex = sectionIndex;
  }

  /**
   * Constructor, for when the file has been renamed, and all other data remains the same.
   * @param newTasksFile
   */
  fromRenamedFile(path: string) {
    return new TaskLocation(path, this.lineNumber, this.sectionStart, this.sectionIndex);
  }

  public get path(): string {
    return this._path;
  }

  public get lineNumber(): number {
    return this._lineNumber;
  }

  /** Line number where the section starts that contains this task. */
  get sectionStart(): number {
    return this._sectionStart;
  }

  /** The index of the nth task in its section. */
  get sectionIndex(): number {
    return this._sectionIndex;
  }

  /**
   * Whether the path is known, that-is, non-empty.
   *
   * This doesn't check whether the path points to an existing file.
   *
   * It was written to allow detection of tasks in Canvas cards, but note
   * that some editing code in this plugin does not bother to set the location
   * of the task, if not needed.
   */
  public get hasKnownPath(): boolean {
    return this.path !== "";
  }
}
