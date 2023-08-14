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

    console.log(`split group: ${groupBy.split(',')}`);
    const noteHandles = groupBy.split(',').map( async tag => {
      console.log(`group by tag: ${tag}`);
      await app.filterNotes({ tag: `${queryTag},${tag}` });
    });
    console.log(`grouped note handles : ${noteHandles}`);
  },

  // --------------------------------------------------------------------------
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
