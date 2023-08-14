const plugin = 
{
  // --------------------------------------------------------------------------------------
  constants: {
    queryTagRegexp: RegExp("\\|Query Tag\\|([a-z\\-\\/]+)", "i"),
    groupByRegexp: RegExp("\\|Group By Tags\\|([a-z\\-\\/,\\s]+)", "i")
  },

  // --------------------------------------------------------------------------
  // https://www.amplenote.com/help/developing_amplenote_plugins#noteOption
  noteOption: async function(app) {
    const content = await app.getNoteContent({ uuid: app.context.noteUUID });
    console.log(`Note content: ${content}`);

    const [queryTag, groupBy] = this._getSettings(content);
    if (!queryTag) {
      app.alert("Query Tag setting must exist");
      return;
    };

    const groupContents = this._getNoteContents(app, queryTag, groupBy.split(','))
      .then(contents => {
        console.log(`groupContents: ${contents}, ${Object.keys(contents)}`);
        console.log(`active contents: ${contents["-status/active"]}`);
        console.log(`backlog contents: ${contents["-status/backlog"]}`);
      });
    // console.log(`split group: ${groupBy.split(',')}`);
    // const notesPromise = groupBy.split(',').map( tag => {
    //   console.log(`group by tag: ${tag}`);
    //   return app.filterNotes({ tag: `${queryTag},${tag}` });
    // });
    // Promise.all(notesPromise)
    //   .then(handles => {
    //     console.log(`grouped note handles : ${handles}`);
    //   });
  },

  // --------------------------------------------------------------------------
  // Impure functions
  async _getNoteContents(app, queryTag, groupTags) {
    console.log(`_getNoteContents: ${queryTag}, ${groupTags}`);
    return await Promise.all(groupTags
      .map(async tag => {
        console.log(`getting content for tag: ${tag}`);
        return await this._getNotesContentForGroup(app, queryTag, tag);
      })
    ).then( contents => {
      console.log("combining dicts");
      return Object.assign({}, ...contents);
    });
  },

  async _getNotesContentForGroup(app, queryTag, groupTag) {
    console.log(`group by tag: ${groupTag}`);
    const noteContents = await Promise.all(
      await app
        .filterNotes({ tag: `${queryTag},${groupTag}` })
        .then(handles => {
          console.log(`handles: ${handles}, ${handles instanceof Array}`);
          return handles.map(noteHandle => {
            console.log(`getting content for: ${noteHandle.uuid}`);
            return app.getNoteContent({ uuid: noteHandle.uuid });
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
  }
};
export default plugin;
