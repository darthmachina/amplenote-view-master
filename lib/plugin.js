const plugin = 
{
  Note: class {
    constructor(uuid, title, content, inlineFields) {
      this.uuid = uuid;
      this.title = title;
      this.content = content;
      this.inlineFields = inlineFields;
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

  // --------------------------------------------------------------------------------------
  constants: {
    queryTagRegexp: RegExp("\\|Query Tag\\|([a-z\\-\\/]+)", "i"),
    groupByRegexp: RegExp("\\|Group By Tags\\|([a-z\\-\\/,\\s]+)", "i"),
    inlineFieldRegexp: /[ -]?([a-zA-Z]*) ?:: ?([a-zA-Z\[]?[a-zA-Z\]\(:/\.0-9-) ]*)$/gm
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
        console.log(`groupContents: ${contents}, ${Object.keys(contents)}`);
        console.log(`active contents: ${contents["-status/active"]}`);
        console.log(`backlog contents: ${contents["-status/backlog"]}`);

        console.log(`fields for active page: ${this._getInlineFields(contents["-status/active"][0])}`)

        const updatedContent = `Wallboard goes here\n${this._createSettingsTable(queryTag, groupBy)}\n`;
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
  async _getNotesForGroupNew(app, queryTag, groupTag) {

  },

  async _getNotesForGroup(app, queryTag, groupTag) {
    console.log(`group by tag: ${groupTag}`);
    const noteContents = await Promise.all(
      await app
        .filterNotes({ tag: `${queryTag},${groupTag}` })
        .then(handles => {
          console.log(`handles: ${handles}, ${handles instanceof Array}`);
          return handles.map(noteHandle => {
            console.log(`getting content for: ${noteHandle.uuid}`);
            return app.notes.find(noteHandle.uuid);
          });
        }));
    console.log(`noteContents: ${noteContents}, ${noteContents instanceof Array}`);
    return { [groupTag]: noteContents };
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

  _getInlineFields(content) {
    console.log(`_getInlineFields: ${content}`);
    var fields = {};
    var match;
    while(match = this.constants.inlineFieldRegexp.exec(content)) {
      console.log(`match: ${match}`);
      console.log(`field: ${match[1]}`);
      console.log(`value: ${match[2]}`);
      fields[match[1]] = match[2];
    }
    console.log(`returning fields: ${Object.keys(fields)}`);
    return fields;
  },

  _getCellContent(note, fields) {
    return `- [${note.title}](https://www.amplenote.com/notes/${note.uuid}/)\n` +
      Object
        .keys(fields)
        .map(field => {
          return `- ${field}:: ${fields[field]}`;
        })
        .join("\n")
      + "\n";
  },

  _getGroupContent(groupTag, notes) {
    return `# ${groupTag}\n`
  }
};
export default plugin;
