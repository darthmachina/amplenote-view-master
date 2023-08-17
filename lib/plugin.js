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

  // --------------------------------------------------------------------------------------
  constants: {
    queryTagRegexp: RegExp("\\|Query Tag\\|([a-z\\-\\/]+)", "i"),
    groupByRegexp: RegExp("\\|Group By Tags\\|([a-z\\-\\/,\\s]+)", "i"),
    inlineFieldRegexp: /[ -]?([a-zA-Z]*) ?:: ?([a-zA-Z\[]?[a-zA-Z\]\(:/\.0-9-) ]*)$/gm,
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

    const [queryTag, groupBy] = this._getSettings(content);
    if (!queryTag) {
      app.alert("Query Tag setting must exist");
      return;
    };

    const groupContents = this._getNotes(app, queryTag, groupBy.split(','))
      .then(notes => {
        console.log(`groupContents: ${JSON.stringify(notes)}, ${Object.keys(notes)}`);
        console.log(`active contents: ${JSON.stringify(notes["-status/active"])}`);
        console.log(`backlog contents: ${JSON.stringify(notes["-status/backlog"])}`);

        const updatedContent = `${this._getFullGroupsContent(notes)}\n\n${this._createSettingsTable(queryTag, groupBy)}\n`;
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
    if (!queryTagMatches || queryTagMatches.length !== 2) {
      app.alert("Query Tag setting must exist");
      return undefined;
    }

    console.log(`query tag : ${queryTagMatches[1]}`);
    console.log(`group by tags : ${groupByMatches[1]}`);

    return [queryTagMatches[1], groupByMatches[1]];
  },

  _createSettingsTable(queryTag, groupTags) {
    return `| | |\n|-|-|\n|Query Tag|${queryTag}|\n|Group By Tags|${groupTags}|`;
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
    return (note.image ? `\t - ![${note.image.image}|${this.constants.defaultImageWidth}](${note.image.url})\n` : "") +
      `- [${note.title}](https://www.amplenote.com/notes/${note.uuid})\n` +
      note.inlineFields
        .map(field => {
          return `- ${field.name}:: ${field.value}`;
        })
        .join("\n");
  },

  _getGroupContent(groupTag, notes) {
    console.log(`_getGroupContent: ${groupTag}, ${JSON.stringify(notes)}`);
    const reducer = (groupContent, cell, index, array) => {
      return groupContent + 
        "|" + // Preface | to start a new table cell
        cell + // Cell contents
        ((index === array.length - 1) && (index > this.constants.defaultTableColumns) ? "| ".repeat(index % this.constants.defaultTableColumns) : "") + // If we're at the end pad the rest of row
        (index % this.constants.defaultTableColumns === 0 ? "|\n" : ""); // If we have filled the columns start a new row
    };

    // Table header as initial value
    const initialValue = "| ".repeat(this.constants.defaultTableColumns) + "|\n" + "|-".repeat(this.constants.defaultTableColumns) + "|\n";

    const notesString = notes
      .map(note => {
        return this._getCellContent(note);
      })
      .reduce(reducer, initialValue); 

    return `# ${groupTag}\n` + notesString;
  },

  // `groupTags` is an object keyed by groupTags with values being a list of Notes
  // Returns a string being the full note content
  _getFullGroupsContent(groupTags) {
    return Object.keys(groupTags)
      .map(groupTag => {
        return this._getGroupContent(groupTag, groupTags[groupTag]);
      })
      .join("\n");
  }
};
export default plugin;
