const plugin = 
{
  Note: class {
    constructor(uuid, title, content, inlineFields, image, totalTasks = 0, completedTasks = 0) {
      this.uuid = uuid;
      this.title = title;
      this.content = content;
      this.inlineFields = inlineFields;
      this.image = image;
      this.totalTasks = totalTasks;
      this.completedTasks = completedTasks;
    }

    copy(uuid = this.uuid, title = this.title, content = this.content, inlineFields = this.inlineFields) {
      return new Note(uuid, title, content, inlineFields);
    }
  },

  InlineField: class {
    constructor(name, value) {
      this.name = name;
      this.value = value;
    }

    copy(name = this.name, value = this.value) {
      return new InlineField(name, value);
    }
  },

  Image: class {
    constructor(image, url) {
      this.image = image;
      this.url = url;
    }

    copy(image = this.image, url = this.url) {
      return new Image(image, url);
    }
  },

  Settings: class {
    constructor(queryTag, groupTags, imageWidth, tableColumns, includeFields, sortBy, displayAs) {
      this.queryTag = queryTag;
      this.groupTags = groupTags;
      this.imageWidth = imageWidth;
      this.tableColumns = tableColumns;
      this.includeFields = includeFields;
      this.sortBy = sortBy;
      this.displayAs = displayAs;
    }

    copy(
      queryTag = this.queryTag, 
      groupTags = this.groupTags, 
      imageWidth = this.imageWidth, 
      tableColumns = this.tableColumns, 
      includeFields = this.includeFields, 
      sortBy = this.sortBy, 
      displayAs = this.displayAs, 
    ) {
      return new Settings(queryTag, groupTags, imageWidth, tableColumns, includeFields, sortBy, displayAs);
    }
  },

  // --------------------------------------------------------------------------------------
  constants: {
    version: "2.0.0",
    settingImageWidthName: "Default image width",
    settingTableColumnsName: "Default table columns",
    queryTagRegexp: /^\|Query Tag\|([a-z\-\/]+)\|\s*$/gmi,
    groupByRegexp: /^\|Group By Tags\|([a-z/,\&\s\^\-]+)\|\s*$/gmi,
    imageWidthRegexp: /^\|Image Width\|([a-z0-9\-\/,\s]+)\|\s*$/gmi,
    tableColumnsRegexp: /^\|Table Columns\|([a-z0-9\-\/,\s]+)\|\s*$/gmi,
    includeFieldsRegexp: /^\|Include Fields\|([a-z0-9\-\/,\s\&+]+)\|\s*$/gmi,
    sortByRegexp: /^\|Sort By\|([a-z0-9\-\/,\s]+)\|\s*$/gmi,
    displayAsRegexp: /^\|Display As\|(gallery|table|list)\|\s*$/gmi,
    inlineFieldRegexp: /[ -]?([a-zA-Z]*) ?:: ?(.*)$/gm,
    imageRegexp: /(http[a-zA-Z0-9\.:/-]*(jpg|png|webp))/gm,
    defaultImageWidth: 125,
    defaultTableColumns: 3
  },

  // --------------------------------------------------------------------------
  // https://www.amplenote.com/help/developing_amplenote_plugins#noteOption
  noteOption: async function(app) {
    const note = await app.notes.find(app.context.noteUUID);
    const content = await note.content();
    console.log(`content: ${content}`);

    this._resetRegExps();
    const settings = this._getSettings(content, app.settings);
    console.log(`settings: ${JSON.stringify(settings)}`);
    if (!settings.queryTag || !settings.groupTags) {
      app.alert("Query Tag and Group By Tags settings must exist");
      return;
    };

    const groupContents = this._getNotes(app, settings, settings.queryTag, settings.groupTags.split('&'))
      .then(notes => {
        const updatedContent = `${this._getFullGroupsContent(settings, notes)}\n\n---\n${this._createSettingsTable(settings, this._getDefaultImageWidth(app.settings), this._getDefaultTableColumns(app.settings))}\n`;
        app.replaceNoteContent({ uuid: app.context.noteUUID }, updatedContent);
      });
  },

  // --------------------------------------------------------------------------
  // Impure functions
  _resetRegExps() {
    this.constants.queryTagRegexp.lastIndex = 0;
    this.constants.groupByRegexp.lastIndex = 0;
    this.constants.imageWidthRegexp.lastIndex = 0;
    this.constants.tableColumnsRegexp.lastIndex = 0;
    this.constants.includeFieldsRegexp.lastIndex = 0;
    this.constants.sortByRegexp.lastIndex = 0;
    this.constants.inlineFieldRegexp.lastIndex = 0;
    this.constants.imageRegexp.lastIndex = 0;
    this.constants.displayAsRegexp.lastIndex = 0;
  },

  async _getNotes(app, settings, queryTag, groupTags) {
    return await Promise.all(groupTags
      .map(async tag => {
        return await this._getNotesForGroup(app, settings, queryTag, tag);
      })
    ).then( notes => {
      return Object.assign({}, ...notes);
    });
  },

  // Returns an array of Notes in a dict keyed by `groupTag`
  async _getNotesForGroup(app, settings, queryTag, groupTag) {
    const notes = await Promise.all(
      await app
        .filterNotes({ tag: `${queryTag},${groupTag}` })
        .then(handles => {
          return handles.map(async noteHandle => {
            const note = await app.notes.find(noteHandle.uuid);
            const noteContent = await note.content();
            const inlineFields = this._getInlineFields(settings, noteContent);
            const image = this._getImage(noteContent);
            let tasks = []
            if (settings.includeFields && settings.includeFields.find(key => key.toLowerCase() === "+progress") != undefined) {
              // Only pull in tasks if something requires the data
              tasks = await app.getNoteTasks({ uuid: noteHandle.uuid }, { includeDone: true });
            }
            return new this.Note(noteHandle.uuid, noteHandle.name, noteContent, inlineFields, image, tasks.length, this._completedTaskCount(tasks));
          });
        })
        );
    return { [groupTag]: this._sortNotes(settings, notes) };
  },

  // --------------------------------------------------------------------------
  // Pure functions
  _getDefaultImageWidth(appSettings) {
    return appSettings[this.constants.settingImageWidthName] || this.constants.defaultImageWidth;
  },

  _getDefaultTableColumns(appSettings) {
    return appSettings[this.constants.settingTableColumnsName] || this.constants.defaultTableColumns;
  },

  _getSettings(content, appSettings) {
    const queryTagMatches = this.constants.queryTagRegexp.exec(content);
    const groupByMatches = this.constants.groupByRegexp.exec(content);
    const imageWidthMatches = this.constants.imageWidthRegexp.exec(content);
    const tableColumnsMatches = this.constants.tableColumnsRegexp.exec(content);
    const includeFieldsMatches = this.constants.includeFieldsRegexp.exec(content);
    const sortByMatches = this.constants.sortByRegexp.exec(content);
    const displayAsMatches = this.constants.displayAsRegexp.exec(content);

    return new this.Settings(
      (queryTagMatches) ? queryTagMatches[1] : undefined,
      (groupByMatches) ? groupByMatches[1] : undefined,
      (imageWidthMatches) ? imageWidthMatches[1] : this._getDefaultImageWidth(appSettings),
      (tableColumnsMatches) ? tableColumnsMatches[1] : this._getDefaultTableColumns(appSettings),
      (includeFieldsMatches) ? includeFieldsMatches[1].split("&") : undefined,
      (sortByMatches) ? sortByMatches[1] : undefined,
      (displayAsMatches) ? displayAsMatches[1] : undefined,
    );
  },

  _createSettingsTable(settings, defaultImageWidth, defaultTableColumns) {
    const imageCell = ((settings.imageWidth == defaultImageWidth) ? "" : `|Image Width|${settings.imageWidth}|\n`);
    const columnsCell = ((settings.tableColumns == defaultTableColumns) ? "" : `|Table Columns|${settings.tableColumns}|\n`);
    const includeFieldsCell = ((!settings.includeFields) ? "" : `|Include Fields|${settings.includeFields.join("&")}|\n`);
    const sortByCell = ((!settings.sortBy) ? "" : `|Sort By|${settings.sortBy}|\n`);
    const displayAsCell = ((!settings.displayAs) ? "" : `|Display As|${settings.displayAs}|\n`);
    return `| | |\n|-|-|\n|Query Tag|${settings.queryTag}|\n|Group By Tags|${settings.groupTags}|\n${imageCell}${columnsCell}${includeFieldsCell}${sortByCell}${displayAsCell}`
  },

  _getInlineFields(settings, noteContent) {
    var fields = new Map();
    var match;
    while(match = this.constants.inlineFieldRegexp.exec(noteContent)) {
      fields.set(match[1], new this.InlineField(match[1], match[2]));
    }

    return fields;
  },

  // Returns an Array of unique fields in the given notes
  _getUniqueFields(notes) {
    console.log(`_getUniqueFields : ${JSON.stringify(notes)}`);
    const fieldSet = new Set();
    notes.forEach(note => {
      Array.from(note.inlineFields.keys()).forEach(fieldName => {
        fieldSet.add(fieldName);
      });
    });
    console.log(`fieldSet: ${JSON.stringify(fieldSet)}`);
    return Array.from(fieldSet);
  },

  _sortNotes(settings, notes) {
    if (settings.sortBy) {
      return notes.toSorted((current, next) => {
        const currentSortBy = parseInt(current.inlineFields.get(settings.sortBy)?.value ?? "99");
        const nextSortBy = parseInt(next.inlineFields.get(settings.sortBy)?.value ?? "99");
        return currentSortBy - nextSortBy;
      });
    } else {
      return notes;
    }
},

  _getImage(noteContents) {
    this.constants.imageRegexp.lastIndex = 0; // Reset the lastIndex as this is a new exec
    const match = this.constants.imageRegexp.exec(noteContents);
    if (match) {
      const urlSplit = match[1].split("/");
      const image = new this.Image(urlSplit[urlSplit.length - 1], match[1]);
      return image;
    }
  },

  _completedTaskCount(tasks) {
    return tasks.reduce((current, next) => {
      return current + (next.hasOwnProperty('completedAt') ? 1 : 0)
    }, 0);
  },

  // Computed Fields
  // Returns the computed value of field
  _computeField(settings, note, fieldName) {
    switch(fieldName.toLowerCase()) {
      case '+progress':
        return this._computeProgress(note);
      default:
        console.error(`${fieldName} is not a valid computed field`);
        return "<ERROR>";
    }
  },

  // Computes an emoji progress bar in 10 steps based on the competion percentage of tasks in the referenced note.
  // If no tasks are in the note or there are no completed tasks, an empty progress bar is returned.
  _computeProgress(note) {
    if (note.totalTasks == 0 || note.completedTasks == 0) {
      return "☆".repeat(10);
    } else {
      const completedPercent = Math.floor(note.completedTasks / note.totalTasks * 10);
      return "★".repeat(completedPercent) + "☆".repeat(10 - completedPercent);
    }
  },

  // `groupTags` is an object keyed by groupTags with values being a list of Notes
  // Returns a string being the full note content
  _getFullGroupsContent(settings, groupTags) {
    return Object.keys(groupTags)
      .map(groupTag => {
        switch(settings.displayAs) {
          case 'gallery':
            console.log("output gallery");
            return this._getGroupContentForGallery(settings, groupTag, groupTags[groupTag]);
          case 'table':
            console.log("output table");
            return this._getGroupContentForTable(settings, groupTag, groupTags[groupTag]);
          default:
            console.error(`${settings.displayAs} is not a valid Display As value`);
        }
      })
      .join("\n");
  },

  // Gallery output functions
  _getCellContentForGallery(settings, fields, note) {
    console.log(`fields: ${JSON.stringify(fields)}`);
    return (note.image ? `![${note.image.image}\\|${settings.imageWidth}](${note.image.url}) <br /> ` : "") +
      `[${note.title}](https://www.amplenote.com/notes/${note.uuid}) <br /> <br /> ` +
      fields
        .map(field => {
          if (field.startsWith("+")) {
            return `**${field}**: ${this._computeField(settings, note, field)}`;
          } else {
            return `**${field}**: ${note.inlineFields.get(field).value}`;
          }
        })
        .join(" <br /> ");
  },

  _getGroupContentForGallery(settings, groupTag, notes) {
    const reducer = (groupContent, cell, index) => {
      return groupContent + 
        "|" + // Preface | to start a new table cell
        cell + // Cell contents
        ((index + 1) % settings.tableColumns === 0 ? "|\n" : ""); // If we have filled the columns start a new row
    };

    // Table header as initial value
    const initialValue = "| ".repeat(settings.tableColumns) + "|\n" + "|-".repeat(settings.tableColumns) + "|\n";

    const notesString = notes
      .map(note => {
        const fields = settings.includeFields || Array.from(note.inlineFields.keys());
        return this._getCellContentForGallery(settings, fields, note);
      })
      .reduce(reducer, initialValue); 

    return `# ${groupTag}\n` + notesString;
  },

  // Table output functions
  _rowImage(settings, note) {
    return `${(note.image ? `![${note.image.image}\\|${settings.imageWidth}](${note.image.url})` : "")}`;
  },

  _rowTitle(note) {
    return `[${note.title}](https://www.amplenote.com/notes/${note.uuid})`;
  },

  _rowFields(settings, fields, note) {
    return `${fields.map(field => {
      if (field.startsWith("+")) {
        return this._computeField(settings, note, field);
      } else {
        return note.inlineFields.get(field)?.value ?? ""
      }
    }).join("|")}`;
  },

  _getRowContentForTable(settings, fields, note) {
    return `|${this._rowImage(settings, note)}|${this._rowTitle(note)}|${this._rowFields(settings, fields, note)}|`;
  },

  _getGroupContentForTable(settings, groupTag, notes) {
    // If no includeFields is set get a list of all unique fields from the notes
    const fields = settings.includeFields || this._getUniqueFields(notes);

    const reducer = (groupContent, row) => {
      return groupContent + row + "\n"
    };

    // Initial value is the table header row with columns for Image, Note and all then included fields in the order they are defined
    const initialValue = `||**Note**|${fields.join("|")}|\n|-|-${"|-".repeat(fields.length)}|\n`;

    const notesString = notes
      .map(note => {
        return this._getRowContentForTable(settings, fields, note);
      })
      .reduce(reducer, initialValue);

    return `# ${groupTag}\n` + notesString;
  }
};
export default plugin;
