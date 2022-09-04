// https://github.com/discordjs/discord.js
// https://github.com/not-an-aardvark/snoowrap

const {getPostFromSubreddit} = require('./modules/reddit');


getPostFromSubreddit('asjkdh')
	.then(console.log)
	.catch(console.error);   