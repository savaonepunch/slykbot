'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { REDDIT_TYPE } = require('../modules/types');
const getPostFromSubreddit = require('../modules/reddit').getPostFromSubreddit;
const config = require('../modules/config.json').reddit;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reddit')
		.setDescription('Get a free reddit post!')
		.addStringOption(option => {
			option.setName('subreddit')
				.setDescription('get a random post from this subreddit');
			return option;
		}),
	async execute(interaction) {
		let subreddit;
		// if user chose no subreddit it fetches from a default subreddit in the config file
		if (interaction.options.get('subreddit') == null) {
			subreddit = config.defaultSubreddits[Number.parseInt(Math.random() * config.defaultSubreddits.length)];
		}
		// fetch from selected subreddit
		else {
			subreddit = interaction.options.get('subreddit').value;
		}

		let response = '';
		await interaction.deferReply();

		getPostFromSubreddit(subreddit).then(async redditObj => {
			switch (redditObj.type) {
			case REDDIT_TYPE.VIDEO:
				response = '📹 [' + redditObj.title + ']' + '(' + redditObj.content + ')';
				break;
			case REDDIT_TYPE.IMAGE:
				response = '📷 [' + redditObj.title + ']' + '(' + redditObj.content + ')';
				break;
			case REDDIT_TYPE.TEXT:
				response = '📃 ' + redditObj.title + '\n \n' + redditObj.content;
				break;
			case REDDIT_TYPE.WEBSITE:
				response = '🌐 [' + redditObj.title + ']' + '(' + redditObj.content + ')';
				break;
			case REDDIT_TYPE.ERROR:
				response = '❌ `' + redditObj.title + '`\n\n`' + redditObj.content + '`';
				break;
			}

			if (typeof response === 'string' && response.length < 2000) {
				await interaction.editReply(response);
			}
			else {
				await interaction.editReply('Text too long >> [here is the link](' + redditObj.postUrl + ')');
			}
		}).catch(redditObj => {
			interaction.editReply('❌ `' + redditObj.title + '\n\n' + redditObj.content + '`');
		});
	},
};