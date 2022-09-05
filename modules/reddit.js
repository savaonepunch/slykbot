'use strict';

require('dotenv').config();
const snoowrap = require('snoowrap');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const ufs = require('url-file-size');
const catbox = require('catbox.moe');
const { RedditObj, REDDIT_TYPE } = require('./types');
const config = require('./config.json').reddit;


// temp file hosting api => default TTL for posts is 1h
const litterbox = new catbox.Litterbox();

// reddit object
const reddit = new snoowrap({
	userAgent: config.userAgent,
	clientId: process.env.REDDIT_CLIENT_ID,
	clientSecret: process.env.REDDIT_CLIENT_SECRET,
	refreshToken: process.env.REDDIT_REFRESH_TOKEN,
});

function fetchOneRandomFrom(subreddit) {
	return new Promise((resolve, reject) => {
		reddit.getSubreddit(subreddit).getRandomSubmission().then(response => {
			// check if Submission or Listing
			if (response.constructor.name === 'Submission') {
				resolve(processSubmission(response));
			}
			// getRandomSubmission randomly returns a Listing => not in docs
			else if (response.constructor.name === 'Listing' && response.length > 0) {
				// pick a random Submission from the "random" Listing
				const random = response[Number.parseInt(Math.random() * response.length)];
				resolve(processSubmission(random));
			}
			else {
				reject('cant find r/' + subreddit);
			}
		}).catch(e => reject(e));
	});
}

function processSubmission(s) {
	return new Promise((resolve) => {
		// check if crosspost: yes => get original post url
		if (s.crosspost_parent_list) {
			s = s.crosspost_parent_list[0];
		}

		// get .mp4 videos
		if (s.media && s.media.reddit_video) {
			resolve(getVideo(s.media.reddit_video.fallback_url, s.title, s.media.reddit_video.is_gif));
		}
		// get images
		else if (s.url.includes('.png') || s.url.includes('.jpg') || s.url.includes('.gif')) {
			let title = s.title.replaceAll('/', '|').replaceAll('"', '˝');
			if (title.length === 1 && title.includes('.')) title = '[dot]';
			resolve(getImage(s.url, title));
		}
		// get text posts
		else if (s.url.includes('/comments/')) {
			resolve(getTextPost(s));
		}
		// get link from external sites
		else {
			resolve(handleExternalSite(s));
		}
	});
}

// option 1: post is image
function getImage(url, title) {
	return new RedditObj(title, url, REDDIT_TYPE.IMAGE, url);
}

// option 2: post is video
function getVideo(url, title, is_gif, retry = false) {
	return new Promise((resolve, reject) => {
		ufs(url).then((size) => {
			// check if file is below upload limit before fetching
			if (size < config.uploadLimit) {
				// spawn a new ffmpeg process for each video
				const proc = new ffmpeg();

				proc.on('error', (e) => {
					if (retry) {
						// if retry failed => fail ... lol
						reject(e);
					}
					else {
						// retry video without audio => maybe .mp4 has no audio
						getVideo(url, title, true, true);
					}
				});

				// add muted video
				proc.addInput(url).withInputOption(['-threads 1']);
				// add audio if no gif
				if (!is_gif) {
					proc.addInput(url.substring(0, url.lastIndexOf('/') + 1) + 'DASH_audio.mp4').withInputOption(['-threads 1']);
				}

				const filepath = config.folderpath + title.replaceAll('/', '|') + '.mp4';
				proc.saveToFile(filepath);

				proc.on('end', () => {
					resolve(new RedditObj(title, filepath, REDDIT_TYPE.VIDEO, url));
				});
			}
		}).catch((e) => {
			reject(e + ' from Video');
		});
	});
}

// option 3: its a link to another website
function handleExternalSite(submission) {
	return new Promise((resolve) => {
		resolve(new RedditObj(submission.title, submission.url, REDDIT_TYPE.WEBSITE, submission.url));
	});
}

// option 4: its a text post
function getTextPost(submission) {
	return new Promise((resolve) => {
		resolve(new RedditObj(submission.title, submission.selftext, REDDIT_TYPE.TEXT, submission.url));
	});
}

// upload file to file host and return the url
function upload(redditObj) {
	const filepath = redditObj.content;
	return new Promise((resolve, reject) => {
		// if its a vid or pic => upload to litterbox and return the url
		litterbox.upload(filepath).then((url) => {
			// after upload delete local file
			fs.unlink(filepath, () => {
				resolve(new RedditObj(redditObj.title, url, redditObj.type, redditObj.url));
			});
		}).catch((e) => {
			// if error from file host => delete orphaned file
			fs.unlink(filepath, () => {
				reject(e);
			});
		});
	});
}

// checks if it can send result directly or needs to upload first
function prepareResult(redditObj) {
	if (redditObj.content.startsWith(config.folderpath)) {
		// if is downloaded file => upload
		return upload(redditObj);
	}
	else {
		// regular string => external link or text post
		return redditObj;
	}
}

// available method to fetch a post as a RedditObj
module.exports.getPostFromSubreddit = function(subreddit, page) {
	return new Promise((resolve, reject) => {
		fetchOneRandomFrom(subreddit, page)
			.then(prepareResult)
			.then(redditObj => {
				// check for random catbox error
				if (redditObj.content.includes('database error')) {
					reject(new RedditObj('external error', redditObj.content, REDDIT_TYPE.ERROR));
				}
				resolve(redditObj);
			})
			.catch(e => {
				reject(new RedditObj('internal error', e, REDDIT_TYPE.ERROR));
			});
	});
};