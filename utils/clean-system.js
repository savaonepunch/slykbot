'use strict';
const fs = require('fs');
const reddit = require('../modules/config.json').reddit;
const log = require('./log');

// startup method to clean orphaned files from failed requests
module.exports.cleanRedditDir = function() {
	const files = fs.readdirSync(reddit.folderpath);

	files.forEach(file => {
		fs.unlinkSync(reddit.folderpath + file);
	});

	log('reddit', `cleaned ${files.length} media files`);
};

// startup method to check media folder
module.exports.checkRedditDir = function() {
	if (fs.existsSync(reddit.folderpath)) {
		log('reddit', 'media folder exists');
	}
	else {
		log('reddit', 'media folder does not exist');
		fs.mkdirSync(reddit.folderpath);
		log('reddit', 'media folder created');
	}
};