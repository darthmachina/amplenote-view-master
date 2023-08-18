const plugin = 
{
  Note: class {
    constructor(uuid, title, content, inlineFields, image) {
      this.uuid = uuid;
      this.title = title;
      this.content = content;
      this.inlineFields = inlineFields;
      this.image = image;
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
    constructor(queryTag, groupTags, imageWidth, tableColumns) {
      this.queryTag = queryTag;
      this.groupTags = groupTags;
      this.imageWidth = imageWidth;
      this.tableColumns = tableColumns;
    }
  },

  // --------------------------------------------------------------------------------------
  constants: {
    queryTagRegexp: RegExp("\\|Query Tag\\|([a-z\\-\\/]+)", "i"),
    groupByRegexp: RegExp("\\|Group By Tags\\|([a-z\\-\\/,\\s]+)", "i"),
    imageWidthRegexp: RegExp("\\|Image Width\\|([a-z0-9\\-\\/,\\s]+)", "i"),
    tableColumnsRegexp: RegExp("\\|Table Columns\\|([a-z0-9\\-\\/,\\s]+)", "i"),
    inlineFieldRegexp: /[ -]?([a-zA-Z]*) ?:: ?([a-zA-Z\[]?[a-zA-Z\]\(:/\.0-9-) ,\[]*)$/gm,
    imageRegexp: /(http[a-zA-Z0-9\.:/-]*(jpg|png))/gm,
    defaultImageWidth: 125,
    defaultTableColumns: 3
  },

  // --------------------------------------------------------------------------
  // https://www.amplenote.com/help/developing_amplenote_plugins#noteOption
  noteOption: async function(app) {
    const note = await app.notes.find(app.context.noteUUID);
    const content = await note.content();
    console.log(`Note content: ${content}`);

    const settings = this._getSettings(content);
    if (!settings.queryTag || !settings.groupTags) {
      app.alert("Query Tag and Group By Tags settings must exist");
      return;
    };
    console.log(`settings: ${JSON.stringify(settings)}`);

    const groupContents = this._getNotes(app, settings.queryTag, settings.groupTags.split(','))
      .then(notes => {
        console.log(`groupContents: ${JSON.stringify(notes)}, ${Object.keys(notes)}`);
        console.log(`active contents: ${JSON.stringify(notes["-status/active"])}`);
        console.log(`backlog contents: ${JSON.stringify(notes["-status/backlog"])}`);

        const updatedContent = `${this._getFullGroupsContent(settings, notes)}\n\n${this._createSettingsTable(settings)}\n`;
        console.log(`updated note content:\n${updatedContent}`);
        app.replaceNoteContent({ uuid: app.context.noteUUID }, updatedContent);
      });
  },

  // --------------------------------------------------------------------------
  // Impure functions
  async _getNotes(app, queryTag, groupTags) {
    console.log(`_getNoteContents: ${queryTag}, ${groupTags}`);
    return await Promise.all(groupTags
      .map(async tag => {
        console.log(`getting content for tag: ${tag}`);
        return await this._getNotesForGroup(app, queryTag, tag);
      })
    ).then( notes => {
      console.log("combining dicts");
      return Object.assign({}, ...notes);
    });
  },

  // Returns an array of Notes in a dict keyed by `groupTag`
  async _getNotesForGroup(app, queryTag, groupTag) {
    console.log(`group by tag: ${groupTag}`);
    const notes = await Promise.all(
      await app
        .filterNotes({ tag: `${queryTag},${groupTag}` })
        .then(handles => {
          console.log(`handles: ${handles}, ${handles instanceof Array}`);
          return handles.map(async noteHandle => {
            console.log(`getting content for: ${JSON.stringify(noteHandle)}`);
            const note = await app.notes.find(noteHandle.uuid);
            const noteContent = await note.content();
            const inlineFields = this._getInlineFields(noteContent);
            const image = this._getImage(noteContent);
            return new this.Note(noteHandle.uuid, noteHandle.name, noteContent, inlineFields, image);
          });
        }));
    console.log(`notes: ${notes}, ${notes instanceof Array}`);
    return { [groupTag]: notes };
  },

  // --------------------------------------------------------------------------
  // Pure functions
  _getSettings(content) {
    const queryTagMatches = this.constants.queryTagRegexp.exec(content);
    const groupByMatches = this.constants.groupByRegexp.exec(content);
    const imageWidthMatches = this.constants.imageWidthRegexp.exec(content);
    const tableColumnsMatches = this.constants.tableColumnsRegexp.exec(content);

    console.log(`query tag : ${queryTagMatches[1]}`);
    console.log(`group by tags : ${groupByMatches[1]}`);
    console.log(`image width: ${JSON.stringify(imageWidthMatches)}`);
    console.log(`table columns: ${JSON.stringify(tableColumnsMatches)}`);

    return new this.Settings(
      (queryTagMatches) ? queryTagMatches[1] : undefined,
      (groupByMatches) ? groupByMatches[1] : undefined,
      (imageWidthMatches) ? imageWidthMatches[1] : this.constants.defaultImageWidth,
      (tableColumnsMatches) ? tableColumnsMatches[1] : this.constants.defaultTableColumns
    );
  },

  _createSettingsTable(settings) {
    console.log(`_createSettingsTable: ${JSON.stringify(settings)}`);
    const imageCell = ((settings.imageWidth == this.constants.defaultImageWidth) ? "" : `|Image Width|${settings.imageWidth}|\n`);
    const columnsCell = ((settings.tableColumns == this.constants.defaultTableColumns) ? "" : `|Table Columns|${settings.tableColumns}|\n`);
    const table = `| | |\n|-|-|\n|Query Tag|${settings.queryTag}|\n|Group By Tags|${settings.groupTags}|\n${imageCell}${columnsCell}`
    console.log(`settings table: ${table}`);
    return table;
  },

  _getInlineFields(noteContent) {
    console.log(`_getInlineFields: ${noteContent}`);
    var fields = [];
    var match;
    while(match = this.constants.inlineFieldRegexp.exec(noteContent)) {
      console.log(`match: ${match}`);
      console.log(`field: ${match[1]}`);
      console.log(`value: ${match[2]}`);
      fields.push(new this.InlineField(match[1],match[2]));
    }
    console.log(`returning fields: ${fields}`);
    return fields;
  },

  _getImage(noteContents) {
    console.log(`_getImage`);
    this.constants.imageRegexp.lastIndex = 0; // Reset the lastIndex as this is a new exec
    const match = this.constants.imageRegexp.exec(noteContents);
    console.log(`\tmatch: ${match}`);
    if (match) {
      console.log(`imageRegexp matched, building Image instance: ${match}`);
      const urlSplit = match[1].split("/");
      const image = new this.Image(urlSplit[urlSplit.length - 1], match[1]);
      console.log(`image: ${JSON.stringify(image)}`);
      return image;
    }
  },

  _getCellContent(note) {
    // return (note.image ? `\t - ![${note.image.image}|${this.constants.defaultImageWidth}](${note.image.url})\n` : "") +
    return `[${note.title}](https://www.amplenote.com/notes/${note.uuid}) <br /> <br /> ` +
      note.inlineFields
        .map(field => {
          return `**${field.name}**: ${field.value}`;
        })
        .join(" <br /> ");
  },

  _getGroupContent(settings, groupTag, notes) {
    console.log(`_getGroupContent: ${groupTag}, ${JSON.stringify(notes)}`);
    const reducer = (groupContent, cell, index, array) => {
      return groupContent + 
        "|" + // Preface | to start a new table cell
        cell + // Cell contents
        ((index === array.length - 1) && (index > settings.tableColumns) ? "| ".repeat(index % settings.tableColumns) : "") + // If we're at the end pad the rest of row
        ((index + 1) % settings.tableColumns === 0 ? "|\n" : ""); // If we have filled the columns start a new row
    };

    // Table header as initial value
    const initialValue = "| ".repeat(settings.tableColumns) + "|\n" + "|-".repeat(settings.tableColumns) + "|\n";

    const notesString = notes
      .map(note => {
        return this._getCellContent(note);
      })
      .reduce(reducer, initialValue); 

    return `# ${groupTag}\n` + notesString;
  },

  // `groupTags` is an object keyed by groupTags with values being a list of Notes
  // Returns a string being the full note content
  _getFullGroupsContent(settings, groupTags) {
    return Object.keys(groupTags)
      .map(groupTag => {
        return this._getGroupContent(settings, groupTag, groupTags[groupTag]);
      })
      .join("\n");
  }
};
export default plugin;
