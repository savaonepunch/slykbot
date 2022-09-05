'use strict';
require('dotenv').config();
const fs = require('fs');
const log = require('./log');
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');


// redeploys slash commands
module.exports.deployCommands = function() {
	const commands = [];
	const commandsPath = path.join(__dirname, '..', 'commands');
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		commands.push(command.data.toJSON());
	}

	const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

	rest.put(Routes.applicationCommands(process.env.APPLICATION_ID), { body: commands })
		.then((data) => log('slash', `registered ${data.length} slash commands.`))
		.catch(e => console.error(e));

};