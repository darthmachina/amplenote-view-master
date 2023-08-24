# View Master Amplenote Plugin

This plugin will create a series of tables based on data contained in other notes. The table will contain images and data for each of the pages tagged with a certain tag, grouped by a list of other tags.

# Usage
Create a note in Amplenote contaning a table with at the following data:

| | |
|-|-|
|Query Tag|example-tag|
|Group By Tags|tag1,tag2|

After running the plugin on the note it will query for all pages with `example-tag` set, create sections for each tag in the `Group By Tags` list and create a view containing data for each note that contains the query tag and the section tag.

# Development

## Testing

Run `NODE_OPTIONS=--experimental-vm-modules npm test` to run the tests.

If it complains about jsdom being absent, run `npm install -D jest-environment-jsdom` and try again.


## Technologies used to help with this project

* https://esbuild.github.io/getting-started/#your-first-bundle
* https://jestjs.io/
* https://www.gitclear.com
